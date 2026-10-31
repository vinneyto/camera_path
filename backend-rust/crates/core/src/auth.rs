use crate::{
    Error, Result,
    database::Db,
    entities::{auth_challenges, editor_sessions, editors},
    ports::Email,
};
use argon2::{
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier,
    password_hash::{SaltString, rand_core::OsRng},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use hmac::{Hmac, Mac};
use rand::{Rng, RngCore};
use sea_orm::{ActiveValue::Set, DbBackend, Statement, entity::prelude::*};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::Sha256;
use std::sync::Arc;

#[derive(Clone)]
pub struct Auth {
    pub db: Db,
    pub secret: String,
    pub ttl: i64,
    pub email_factor: bool,
    pub sender: Arc<dyn Email>,
}
#[derive(Serialize, Deserialize)]
struct Claims {
    sub: String,
    ver: String,
    jti: String,
    iat: i64,
    exp: i64,
    iss: String,
    aud: String,
    amr: String,
}
pub fn now() -> i64 {
    chrono::Utc::now().timestamp()
}
pub fn normalize_email(email: &str) -> Result<String> {
    let email = email.trim().to_lowercase();
    let parts = email.split('@').collect::<Vec<_>>();
    if email.len() > 128
        || parts.len() != 2
        || parts[0].is_empty()
        || !parts[1].contains('.')
        || email.chars().any(char::is_whitespace)
        || email.chars().any(char::is_control)
    {
        return Err(Error::invalid("A valid email address is required"));
    }
    Ok(email)
}
impl Auth {
    pub fn signing_secret(&self) -> Result<()> {
        if self.secret.len() < 32 {
            return Err(Error::new(
                503,
                "http_error",
                "Configure CAMERA_PATH_JWT_SECRET with at least 32 bytes",
            ));
        }
        Ok(())
    }
    pub fn digest(&self, value: &str) -> String {
        let mut mac = Hmac::<Sha256>::new_from_slice(self.secret.as_bytes())
            .expect("HMAC accepts arbitrary keys");
        mac.update(value.as_bytes());
        mac.finalize()
            .into_bytes()
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect()
    }
    async fn throttle(&self, operation: &str, source: &str, sending: bool) -> Result<()> {
        self.signing_secret()?;
        let time = now();
        let limit = if sending {
            5
        } else if operation == "login" {
            10
        } else {
            30
        };
        let mut keys = vec![
            (
                format!("{operation}:account:{}", time / 60),
                limit,
                time + 120,
            ),
            (
                format!("{operation}:source:{}:{}", self.digest(source), time / 60),
                limit,
                time + 120,
            ),
        ];
        if sending {
            keys.push((format!("send:hour:{}", time / 3600), 20, time + 7200));
        }
        let tx = self.db.write().await?;
        tx.execute_raw(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            "DELETE FROM auth_rate_limits WHERE expires_at <= ?",
            [time.into()],
        ))
        .await?;
        let mut limited = false;
        for (key, limit, expiry) in keys {
            let row=tx.query_one_raw(Statement::from_sql_and_values(DbBackend::Sqlite,"INSERT INTO auth_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",[key.into(),expiry.into()])).await?.ok_or_else(||Error::new(500,"internal_error","Missing rate limit"))?;
            let count: i64 = row.try_get("", "count")?;
            limited |= count > limit;
        }
        tx.commit().await?;
        if limited {
            return Err(Error::throttled(60));
        }
        Ok(())
    }
    async fn token<C: ConnectionTrait>(&self, db: &C, editor: &editors::Model) -> Result<Value> {
        let time = now();
        let session = crate::models::new_id();
        editor_sessions::ActiveModel {
            id: Set(session.clone()),
            expires_at: Set(time + self.ttl),
        }
        .insert(db)
        .await?;
        let claims = Claims {
            sub: "editor".into(),
            ver: editor.credential_version.clone(),
            jti: session,
            iat: time,
            exp: time + self.ttl,
            iss: "camera-path".into(),
            aud: "camera-path-api".into(),
            amr: if self.email_factor { "email" } else { "off" }.into(),
        };
        let token = jsonwebtoken::encode(
            &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::HS256),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(self.secret.as_bytes()),
        )
        .map_err(|_| Error::new(500, "internal_error", "Could not sign session"))?;
        Ok(json!({"access_token":token,"expires_in":self.ttl,"token_type":"bearer"}))
    }
    fn challenge_response(challenge: &auth_challenges::Model) -> Value {
        json!({"challenge_id":challenge.id,"expires_in":(challenge.expires_at-now()).max(0),"resend_after":(challenge.resend_at-now()).max(0)})
    }
    async fn deliver(&self, id: &str, email: &str, code: &str, digest: &str) -> Result<Value> {
        self.sender.send_code(email, code).await.map_err(|_| {
            Error::new(
                503,
                "http_error",
                "Unable to send sign-in code; try again later",
            )
        })?;
        let tx = self.db.write().await?;
        let mut c = auth_challenges::Entity::find_by_id(id)
            .one(&tx)
            .await?
            .ok_or_else(Error::unauthorized)?;
        let e = editors::Entity::find_by_id("editor")
            .one(&tx)
            .await?
            .ok_or_else(Error::unauthorized)?;
        if c.code_digest != digest
            || c.credential_version != e.credential_version
            || c.expires_at <= now()
        {
            return Err(Error::unauthorized());
        }
        c.delivered = true;
        let response = Self::challenge_response(&c);
        auth_challenges::ActiveModel {
            id: Set(c.id),
            delivered: Set(true),
            ..Default::default()
        }
        .update(&tx)
        .await?;
        tx.commit().await?;
        Ok(response)
    }
    pub async fn login(&self, username: &str, password: &str, source: &str) -> Result<Value> {
        self.throttle("login", source, false).await?;
        let email = normalize_email(username).unwrap_or_default();
        let editor = editors::Entity::find_by_id("editor")
            .one(&self.db.connection)
            .await?;
        // Always perform an expensive hash, including when no editor exists.
        let hash = editor.as_ref().map(|e| e.password_hash.clone());
        let password = password.to_owned();
        let valid = tokio::task::spawn_blocking(move || {
            if let Some(hash) = hash {
                PasswordHash::new(&hash).is_ok_and(|h| {
                    Argon2::default()
                        .verify_password(password.as_bytes(), &h)
                        .is_ok()
                })
            } else {
                let _ = Argon2::default()
                    .hash_password(password.as_bytes(), &SaltString::generate(&mut OsRng));
                false
            }
        })
        .await
        .map_err(|_| Error::new(500, "internal_error", "Password verification failed"))?;
        let editor = editor
            .filter(|e| e.username == email && valid)
            .ok_or_else(Error::unauthorized)?;
        let tx = self.db.write().await?;
        let current = editors::Entity::find_by_id("editor")
            .one(&tx)
            .await?
            .ok_or_else(Error::unauthorized)?;
        if current.credential_version != editor.credential_version {
            return Err(Error::unauthorized());
        }
        editor_sessions::Entity::delete_many()
            .filter(editor_sessions::Column::ExpiresAt.lte(now()))
            .exec(&tx)
            .await?;
        if !self.email_factor {
            let token = self.token(&tx, &editor).await?;
            tx.commit().await?;
            return Ok(token);
        }
        tx.commit().await?;
        self.throttle("send", source, true).await?;
        let (code, id) = random_challenge();
        let digest = self.digest(&format!("{id}:{code}"));
        let time = now();
        let tx = self.db.write().await?;
        let current = editors::Entity::find_by_id("editor")
            .one(&tx)
            .await?
            .ok_or_else(Error::unauthorized)?;
        if current.credential_version != editor.credential_version {
            return Err(Error::unauthorized());
        }
        auth_challenges::Entity::delete_many()
            .filter(auth_challenges::Column::ExpiresAt.lte(time))
            .exec(&tx)
            .await?;
        auth_challenges::ActiveModel {
            id: Set(id.clone()),
            credential_version: Set(editor.credential_version),
            code_digest: Set(digest.clone()),
            expires_at: Set(time + 300),
            resend_at: Set(time + 60),
            attempts: Set(0),
            delivered: Set(false),
        }
        .insert(&tx)
        .await?;
        tx.commit().await?;
        self.deliver(&id, &email, &code, &digest).await
    }
    pub async fn verify(&self, id: &str, code: &str, source: &str) -> Result<Value> {
        self.throttle("verify", source, false).await?;
        let tx = self.db.write().await?;
        let challenge = auth_challenges::Entity::find_by_id(id).one(&tx).await?;
        let editor = editors::Entity::find_by_id("editor").one(&tx).await?;
        let mut result = None;
        if let (Some(c), Some(e)) = (challenge, editor)
            && c.delivered
            && c.expires_at > now()
            && c.attempts < 5
            && c.credential_version == e.credential_version
        {
            auth_challenges::ActiveModel {
                id: Set(c.id.clone()),
                attempts: Set(c.attempts + 1),
                ..Default::default()
            }
            .update(&tx)
            .await?;
            let mut mac = Hmac::<Sha256>::new_from_slice(self.secret.as_bytes()).unwrap();
            mac.update(format!("{id}:{code}").as_bytes());
            let expected = decode_hex(&c.code_digest);
            if mac.verify_slice(&expected).is_ok() {
                auth_challenges::Entity::delete_by_id(id).exec(&tx).await?;
                editor_sessions::Entity::delete_many()
                    .filter(editor_sessions::Column::ExpiresAt.lte(now()))
                    .exec(&tx)
                    .await?;
                result = Some(self.token(&tx, &e).await?);
            }
        }
        tx.commit().await?;
        result.ok_or_else(Error::unauthorized)
    }
    pub async fn resend(&self, id: &str, source: &str) -> Result<Value> {
        self.throttle("send", source, true).await?;
        let time = now();
        let (code, _) = random_challenge();
        let digest = self.digest(&format!("{id}:{code}"));
        let tx = self.db.write().await?;
        let c = auth_challenges::Entity::find_by_id(id)
            .one(&tx)
            .await?
            .ok_or_else(Error::unauthorized)?;
        let e = editors::Entity::find_by_id("editor")
            .one(&tx)
            .await?
            .ok_or_else(Error::unauthorized)?;
        if c.expires_at <= time || c.attempts >= 5 || c.credential_version != e.credential_version {
            return Err(Error::unauthorized());
        }
        if c.resend_at > time {
            return Err(Error::throttled(c.resend_at - time));
        }
        auth_challenges::ActiveModel {
            id: Set(c.id),
            code_digest: Set(digest.clone()),
            expires_at: Set(time + 300),
            resend_at: Set(time + 60),
            delivered: Set(false),
            ..Default::default()
        }
        .update(&tx)
        .await?;
        tx.commit().await?;
        self.deliver(id, &e.username, &code, &digest).await
    }
    pub async fn principal(&self, token: Option<&str>) -> Result<(String, String)> {
        self.signing_secret()?;
        let token = token.ok_or_else(Error::unauthorized)?;
        let mut validation = jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256);
        validation.leeway = 0;
        validation.set_issuer(&["camera-path"]);
        validation.set_audience(&["camera-path-api"]);
        validation.set_required_spec_claims(&["sub", "jti", "iat", "exp", "iss", "aud", "ver"]);
        let claims = jsonwebtoken::decode::<Claims>(
            token,
            &jsonwebtoken::DecodingKey::from_secret(self.secret.as_bytes()),
            &validation,
        )
        .map_err(|_| Error::unauthorized())?
        .claims;
        if claims.sub != "editor" || (self.email_factor && claims.amr != "email") {
            return Err(Error::unauthorized());
        }
        let session = editor_sessions::Entity::find_by_id(&claims.jti)
            .one(&self.db.connection)
            .await?
            .ok_or_else(Error::unauthorized)?;
        let editor = editors::Entity::find_by_id("editor")
            .one(&self.db.connection)
            .await?
            .ok_or_else(Error::unauthorized)?;
        if session.expires_at <= now() || editor.credential_version != claims.ver {
            return Err(Error::unauthorized());
        }
        Ok((editor.username, session.id))
    }
    pub async fn logout(&self, token: Option<&str>) -> Result<()> {
        let (_, id) = self.principal(token).await?;
        editor_sessions::Entity::delete_by_id(id)
            .exec(&self.db.connection)
            .await?;
        Ok(())
    }
    pub async fn create_editor(&self, email: &str, password: String) -> Result<()> {
        self.signing_secret()?;
        let email = normalize_email(email)?;
        if password.len() < 12 || password.len() > 1024 {
            return Err(Error::invalid(
                "Password must contain 12 to 1024 characters",
            ));
        }
        let hash = tokio::task::spawn_blocking(move || {
            let params = argon2::Params::new(65536, 3, 4, None).unwrap();
            Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params)
                .hash_password(password.as_bytes(), &SaltString::generate(&mut OsRng))
                .map(|h| h.to_string())
        })
        .await
        .map_err(|_| Error::new(500, "internal_error", "Password hashing failed"))?
        .map_err(|_| Error::new(500, "internal_error", "Password hashing failed"))?;
        let tx = self.db.write().await?;
        editor_sessions::Entity::delete_many().exec(&tx).await?;
        auth_challenges::Entity::delete_many().exec(&tx).await?;
        editors::Entity::delete_many().exec(&tx).await?;
        editors::ActiveModel {
            id: Set("editor".into()),
            username: Set(email),
            password_hash: Set(hash),
            credential_version: Set(crate::models::new_id()),
        }
        .insert(&tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }
}
fn random_challenge() -> (String, String) {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    (
        format!("{:06}", rand::thread_rng().gen_range(0..1_000_000)),
        URL_SAFE_NO_PAD.encode(bytes),
    )
}
fn decode_hex(input: &str) -> Vec<u8> {
    (0..input.len())
        .step_by(2)
        .filter_map(|i| {
            input
                .get(i..i + 2)
                .and_then(|s| u8::from_str_radix(s, 16).ok())
        })
        .collect()
}
