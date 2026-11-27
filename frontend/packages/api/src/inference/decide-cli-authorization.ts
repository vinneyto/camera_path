import { decideCliDevice } from "@camera-path/api/client/generated/client";

export async function decideCliAuthorization(
  userCode: string,
  approve: boolean,
) {
  await decideCliDevice({ user_code: userCode, approve });
}
