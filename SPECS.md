# Camera Path — спецификация backend

Основной документ для реализации и изменения backend: **`SPECS.md → code → tests`**.
Здесь собраны поведение, данные и границы системы. Документ редактируется человеком;
агент по явному запросу приводит реализацию в соответствие с изменёнными требованиями.

Первичная сверка: 31 октября 2026, `main` на commit
[`32d1940`](https://github.com/vinneyto/camera_path/commit/32d194088acd79b8f03c8298d94baf85800a416b).
Это исходная точка документа, а не требование навсегда сохранить эту реализацию.
Разделы 1–13 описывают действующий Python-backend. Раздел 14 содержит известные
ограничения; раздел 15 — будущие изменения, которые ещё не входят в контракт `main`.

## Содержание

- [1. Как работать со спецификацией](#1-как-работать-со-спецификацией)
- [2. Назначение и границы](#2-назначение-и-границы)
- [3. Сущности и значения по умолчанию](#3-сущности-и-значения-по-умолчанию)
- [4. HTTP, ревизии и ошибки](#4-http-ревизии-и-ошибки)
- [5. Проекты и редактирование сцены](#5-проекты-и-редактирование-сцены)
- [6. Таймлайны](#6-таймлайны)
- [7. Компиляция траектории](#7-компиляция-траектории)
- [8. Библиотека и облака проекта](#8-библиотека-и-облака-проекта)
- [9. Авторизация и профиль](#9-авторизация-и-профиль)
- [10. Чат и агент](#10-чат-и-агент)
- [11. Хранение, конфигурация и эксплуатация](#11-хранение-конфигурация-и-эксплуатация)
- [12. Реестр HTTP-операций](#12-реестр-http-операций)
- [13. Проверка соответствия](#13-проверка-соответствия)
- [14. Ограничения и открытые вопросы](#14-ограничения-и-открытые-вопросы)
- [15. Запланированные изменения](#15-запланированные-изменения)
- [16. Источники и карта реализации](#16-источники-и-карта-реализации)

## 1. Как работать со спецификацией

**SPEC-01. Приоритет.** После принятия этого документа он задаёт ожидаемое поведение
backend. Код и тесты реализуют и проверяют требования; обнаруженное расхождение
нужно назвать явно. Ошибку реализации нельзя автоматически превращать в требование.
OpenAPI — точная машинная форма HTTP-контракта; она генерируется из реализации и
должна согласовываться с этой спецификацией, а не становиться независимым источником решений.
README содержит инструкции запуска, карточки Drive — историю, план и критерии отдельных работ.

**SPEC-02. Изменение.** Пользователь меняет нужное требование и просит реализовать
его. Агент читает актуальную спеку, определяет затронутые операции, данные, миграции
и клиентов, затем меняет код и необходимые проверки. Если запрос на реализацию сам
уточняет требование, соответствующая правка спеки входит в тот же PR. Если обнаружено
противоречие, его нужно объяснить до выбора несовместимого поведения.

**SPEC-03. Граница задания.** Редактирование спеки само по себе не запускает
реализацию. Задание относится к указанным требованиям, а не ко всему backlog из
раздела 15. Этот документ не является автоматически исполняемым генератором кода.

**SPEC-04. Стабильные ссылки.** Идентификаторы вида `API-01`, `LIB-02` сохраняются при
перестановке текста; удалённые номера не переиспользуются. Новое требование получает
новый номер. PR указывает затронутые требования, выполненные проверки и оставшиеся
расхождения. Существенное изменение поведения сопровождается правкой спеки,
OpenAPI/клиента при изменении HTTP и миграцией при изменении сохраняемых данных.

## 2. Назначение и границы

**SCOPE-01.** Backend обслуживает редактор 3D camera path: хранит проекты и сцену,
семантический путь, настройки движения и камеры, общую библиотеку 3DGS и её экземпляры
в проектах. Он компилирует путь в данные для playback и предоставляет чат с агентом,
который может редактировать разрешённую часть проекта.

**SCOPE-02.** Редактируемые данные и compiled trajectory разделены. Компиляция —
производное чтение, которое не изменяет проект. Рендеринг сплатов, picking,
покадровое вычисление камеры, autofocus и LiDAR-пересечения выполняются клиентом.
Backend не декодирует и не тренирует 3DGS при обычной загрузке файла.

**SCOPE-03.** Это общая опубликованная сцена: гость читает данные, единственный
редактор изменяет их после входа. Пользовательских приватных проектов, регистрации,
ролей для нескольких редакторов и отдельных библиотек пользователей сейчас нет.
Основные функции геометрии и REST работают без OpenAI credentials.

## 3. Сущности и значения по умолчанию

**DATA-01.** ID — строки; новые проекты, сущности сцены, ключи, ассеты и экземпляры
облаков получают серверные UUID. Для auth challenge используется отдельный opaque ID. Ссылки на сущности
сцены разрешаются внутри соответствующего проекта. Порядок сегментов, сообщений и
облаков сохраняется. `Vec3` в JSON — массив `[x, y, z]`. Координаты и длины заданы в
единицах сцены; физические метры и м/с получаются при метрическом масштабе сцены.

| Сущность | Данные и правила |
| --- | --- |
| ProjectMetadata | `id`, `name`, `revision`, `anchor_count`, `segment_count`; без вложенного проекта |
| Project | Внутреннее составное представление: anchors, scene points, ordered segments, camera track, motion profile, chat history; облака читаются отдельно |
| Anchor | `id`, `label` (1–64 символа), `surface_position`, ненулевая `surface_normal`, `lift`, `lift_axis` |
| ScenePoint | `id`, `label` (1–64 символа), `position`; независимая цель aim/DOF |
| SplineSegment | `id`, `kind="spline"`, упорядоченные `anchor_ids` (минимум 2), `tension` в `[0,1]` |
| SpiralSegment | `id`, `kind="spiral"`, start/center/end anchor IDs, `turns` в `(0,100]`, direction, radial/axial law |
| SpeedKeyframe | `id`, `path_position`, положительная `speed`, `interpolation_to_next` |
| CameraKeyframe | `id`, `path_position`, `aim`, `interpolation_to_next` |
| CameraOrientationKeyframe | `id`, `path_position`, `orientation`, `interpolation_to_next` |
| DepthOfFieldKeyframe | `id`, `path_position`, `focus`, `focus_range_scale > 0`, `bokeh_scale >= 0` |
| LidarKeyframe | Один optional presence keyframe при `path_position=0`, статические angular settings |
| ChatHistoryMessage | `id`, `role=user\|assistant`, `content`; сообщения упорядочены |
| LibraryAsset | Серверный `id`, `name`, `format=ply\|sog`, `size_bytes`, `status=pending\|ready`, `created_at`, default transform, вычисляемый `download_url` |
| ProjectCloud | Собственный `id`, `project_id`, `library_asset_id`, порядок, visibility, translation/rotation/scale/offset; имя, формат и URL разрешаются из ассета |

**DATA-02.** Новый проект имеет имя `Untitled camera path` (допустимо 1–128 символов),
revision `0` и пустые коллекции. Начальные значения:

| Настройка | Значение |
| --- | --- |
| Anchor normal / lift / lift_axis | `[0,1,0]` / `0` / `world_up` |
| Spline tension | `0` |
| Spiral turns / direction / radial_law / axial_law | `1` / `ccw` / `smoothstep` / `smoothstep` |
| Motion default_speed | `1` |
| Camera default_aim / world_up | `{kind:"follow_path", direction:"forward"}` / `[0,1,0]` |
| Camera default_orientation | `{yaw_deg:0, pitch_deg:0, roll_deg:0}` |
| Interpolation for speed/aim/orientation keys | `smoothstep` |
| DOF key focus / focus_range_scale / bokeh_scale | `{kind:"center_weighted_9"}` / `0.25` / `6` |
| LiDAR | Отсутствует; при создании — `60°`, `512 × 32` |
| Library default_rotation_deg / default_scale / default_offset | `[0,0,0]` / `1` / `[0,0,0]` |
| Cloud translation / visible | `[0,0,0]` / `true` |

**DATA-03.** `path_position` всех ключей лежит в `[0,1]` и означает нормализованную
длину дуги **всего** пути: пройденное расстояние / полная длина. Это не время и не
локальный параметр Bézier. Внутри каждого speed/aim/orientation/DOF timeline позиции
уникальны; одинаковые позиции в разных таймлайнах допустимы. Пустой aim timeline
допустим: обязательного ключа в позиции `0` нет.

## 4. HTTP, ревизии и ошибки

**API-01.** Канонический JSON API находится под `/api/v1`. Чтение возвращает metadata,
конкретный ресурс или список, без полного `Project`. Исключение по объёму данных —
производный `CompiledTrajectory`. `ChatResponse` содержит `{answer, compiled}`.
Списки пока возвращаются целиком, без пагинации. Полный реестр — в разделе 12.

**API-02.** Все ресурсы проекта используют одну project revision. Чтение одного
проекта/его ресурсов и обычные ответы мутаций содержат `ETag: "<revision>"`.
Создание проекта не требует `If-Match`. Для `POST/PATCH/DELETE` канонического API,
адресующих существующий `{project_id}`, редактор передаёт актуальный `If-Match`.
Текущий parser принимает quoted integer и weak форму `W/"4"`; списки ETag, `*` и
некавыченный integer не поддерживаются. Это сравнение ревизий, не HTTP cache API.

**API-03.** Пропущенный `If-Match` даёт `428`; некорректный или устаревший — `409`.
Конкурирующие изменения не должны теряться: изменение ресурса и атомарное повышение
ревизии происходят в одной транзакции с проверкой ожидаемой ревизии. Неуспешная
транзакция не изменяет данные или ревизию. Обычная сохранённая правка повышает её на
один; явно идемпотентные операции могут сохранить прежнее значение. Удаление самого
проекта возвращает его последнюю ревизию, поскольку новой строки уже не существует.

**API-04.** Чат имеет две границы сохранения: user message и итог agent turn
(раздел 10). Для SSE актуальная итоговая ревизия находится в `result.compiled.revision`,
а не в заголовке, отправленном до завершения работы. Мутации библиотеки и профиля не
требуют project ETag; удаление ассета само повышает ревизии затронутых проектов.

**API-05.** Канонические ошибки имеют `{code, detail, field_errors?}`. У validation
errors `field_errors` содержит `location`, `message`, `type`. Основные соответствия:

| HTTP | code / ситуация |
| --- | --- |
| 401 | `http_error`: отсутствующая, неверная или отозванная сессия; `WWW-Authenticate: Bearer` для auth-required |
| 404 | `project_not_found` для проекта; `not_found` для остальных отсутствующих ресурсов |
| 409 | `revision_conflict`, `chat_message_conflict`, `reference_conflict` |
| 413 | `http_error`: локальная загрузка превысила заявленный размер |
| 422 | `validation_error`, `invalid_geometry`; часть явных проверок ресурсов возвращает `http_error` |
| 428 | `if_match_required` |
| 429 | `http_error`: auth rate limit / resend cooldown, с `Retry-After` |
| 502 | `storage_unavailable` для ошибки storage adapter; `upstream_error` для HTTP-level upstream failure |
| 503 | `agent_unavailable` для HTTP 503; встречается также при недоступности auth-конфигурации/доставки почты |

Имена некоторых текущих error codes шире своего исторического названия: например,
`agent_unavailable` не гарантирует, что ошибка относится именно к агенту. Изменение
этого mapping — отдельное изменение контракта. Ошибки после начала SSE передаются
событием `error`, а не новым HTTP-статусом.

**API-06.** CORS разрешает настроенные frontend origins, credentials и чтение ETag.
Клиент, получивший несколько project resources разных ревизий, перечитывает ответы
старее максимальной наблюдаемой ревизии. После мутации перечитывается изменённый
ресурс и зависимая compiled trajectory; agent/reset инвалидируют все ресурсы проекта.
Старая ревизия ответа не должна откатывать более новое состояние клиента.

**API-07.** Unversioned project routes временно поддерживают aggregate ответы для
совместимости и не требуют `If-Match`; запись всё равно требует редактора. Они скрыты
из OpenAPI. Изменение бизнес-правила применяется согласованно к обоим путям. Удаление
legacy API требует отдельного согласованного перехода клиентов. Undo/redo не смонтированы.

## 5. Проекты и редактирование сцены

**PROJECT-01.** Создание возвращает metadata пустого проекта. Список содержит metadata
с актуальными количествами anchors/segments. Переименование сохраняет ID и ресурсы.
Удаление проекта удаляет его scene resources, таймлайны, чат и cloud instances;
файлы общей библиотеки остаются.

**PROJECT-02.** Reset сохраняет ID и имя, очищает anchors, scene points, segments,
таймлайны, чат и экземпляры облаков, восстанавливает начальные настройки, повышает
ревизию. Он не удаляет библиотечные ассеты и настройки профиля.

**SCENE-01.** Фактическая позиция anchor вычисляется как
`surface_position + lift × axis`. Для `world_up` axis равен `[0,1,0]`; для
`surface_normal` используется нормализованная normal. Отрицательный lift допустим.
Изменение anchor сохраняет его ID и ссылки. Anchor, используемый spline/spiral,
нельзя удалить: ответ `409`, без частичного изменения сцены.

**SCENE-02.** ScenePoint может использоваться default aim, aim keyframes и DOF.
Удаление используемой точки без cascade возвращает `409`. `?cascade=true` удаляет
зависимые aim/DOF keyframes и точку атомарно. Если точку использует **default aim**,
удаление запрещено и с cascade: сначала требуется изменить default aim. Ссылки на
точку другого проекта не разрешаются.

**SCENE-03.** Сегменты добавляются в конец упорядоченного пути; spline ссылается на
последовательность anchors, spiral — на start/center/end. Ссылки проверяются перед
сохранением. Удаление сегмента сохраняет anchors и остальные настройки. Отдельных
операций update/reorder segment сейчас нет.

**SCENE-04.** Clear trajectory удаляет segments и все motion/camera timelines,
включая LiDAR, восстанавливая baseline defaults. Anchors, scene points, chat,
cloud instances, имя и ID проекта сохраняются. Clear chat удаляет только историю.
Удаление отдельного timeline описано ниже и не равнозначно clear trajectory/reset.

## 6. Таймлайны

**TIME-01. Скорость.** `default_speed > 0`; каждый speed key хранит положительную
скорость и переход к следующему ключу: `hold`, `linear` или `smoothstep`.
`hold` удерживает левое значение до следующего ключа; `linear` интерполирует его
линейно; `smoothstep` использует `u²(3−2u)`. При непокрытых концах пути compiler
добавляет default speed в `0`/`1`. Удаление speed timeline очищает ключи и ставит
`default_speed=1`, сохраняя остальные ресурсы.

**TIME-02. Aim.** `follow_path` использует tangent вперёд/назад; `look_at_point`
ссылается на ScenePoint. Есть default aim, ненулевой world_up и optional keyframes.
Compiler разрешает ScenePoint в world-space position и сортирует ключи. Runtime
вычисляет направления, интерполирует их, нормализует и строит frame с world_up.
Удаление aim timeline очищает ключи, возвращает forward follow_path и `[0,1,0]`.

**TIME-03. Ориентация.** Конечные `yaw_deg/pitch_deg/roll_deg` задаются в градусах,
без ограничения диапазона и wrap: `0 → 360` означает полный оборот. Default orientation
и ключи независимы от aim. Runtime применяет offsets к aim frame в порядке yaw вокруг
local up, pitch вокруг local right, roll вокруг view axis. Переходы интерполируют
скалярные углы. Удаление timeline очищает ключи и обнуляет default orientation.
`PATCH /camera/orientation` принимает непосредственно три угла, без keyframe wrapper.

**TIME-04. DOF.** Focus — `center_weighted_9` или `scene_point` с существующим ID.
Compiler разрешает scene-point focus в position. Создание timeline без body добавляет
default key при позиции `0`, только если ключей ещё нет; повтор сохраняет существующие
ключи и ревизию. Удаление timeline очищает все DOF keys; удаление последнего ключа
оставляет пустой timeline. В контракте DOF key нет `interpolation_to_next`.

**TIME-05. LiDAR.** Отсутствие keyframe отключает sensor. `PATCH /camera/lidar`
создаёт/обновляет singleton при позиции `0`; `{}` создаёт defaults либо сохраняет
уже заданные параметры. ID существующего singleton сохраняется. Параметры статичны:

| Поле | Ограничение | Default |
| --- | --- | --- |
| `vertical_fov_deg` | Конечное число, `0 < fov < 180` | `60` |
| `horizontal_resolution` | Строго integer, `1..4096` | `512` |
| `vertical_resolution` | Строго integer, `1..256` | `32` |

Неизвестные поля и анимированные позиции отклоняются. Горизонтальный угол равен
360°, вертикальный диапазон — `−fov/2 .. +fov/2`; разрешения задают число angular
samples. Удаление удаляет singleton. Настройки читаются отдельным ресурсом LiDAR;
они не входят в текущий `CompiledCameraTrack`. Вычисление попаданий — ответственность renderer.

## 7. Компиляция траектории

**GEOM-01.** Compiler валидирует ссылки, уникальность позиций ключей и ненулевой
world_up. Разрыв между соседними segments по anchor ID — warning `not C0-connected`,
а не запрет сохранить путь. Несовместимые аналитические tangents соседних spirals —
warning. `tension` сохраняется для совместимости, но не влияет на minimum-jerk spline;
ненулевое значение сопровождается warning. Обязательного стартового aim key нет.

**GEOM-02. Spline.** Соседние splines с общим граничным anchor объединяются в run.
По lifted anchor positions строится глобальный C² minimum-jerk quintic path:
centripetal knot spacing, совместное решение velocities/accelerations, natural endpoint
conditions. На границе с analytic spiral учитывается её tangent direction. Quintic
адаптивно аппроксимируется cubic Bézier с настроенной tolerance. Это не Catmull–Rom.
Совпадающие последовательные позиции anchors не компилируются.

**GEOM-03. Spiral.** Ось — world Y через center anchor. Start/end задают радиусы,
высоты и конечную фазу; выбирается фаза, ближайшая к requested turns без смены
направления. Start не может лежать на оси. При end на оси сохраняется requested
turn count. Radius/height меняются по `linear`/`smoothstep`. Угловой интервал делится
на части не больше 45°, cubic controls строятся из endpoint positions/derivatives.
Концы совпадают с lifted start/end; analytic spiral не деформируется на стыке со spline.

**GEOM-04. Длина и время.** Для cubic recursively сравниваются chord/control-polygon
lengths; subdivision даёт длину и adaptive `(segment_index,t,distance)` table.
Расстояния накоплены по всему пути, длина равна сумме curve lengths. Время вычисляется
как `total_length × integral(1 / speed(path_position), 0..1)`, с 16-point
Gauss–Legendre quadrature на интервалах controls. Пустой путь даёт пустые curves/table,
нулевую длину и длительность. При постоянной скорости `duration=length/speed`.

**GEOM-05. Output.** `CompiledTrajectory` содержит `project_id`, `revision`,
`position_segments` с `source_segment_id`, control points и length, `arc_length_table`,
`total_length`, `duration_seconds`, отсортированные motion/camera/DOF keys, resolved
point references и `warnings`. Frame/quaternion по кадрам backend не выдаёт. Compilation
повторяема для одинаковых входов в пределах численной точности, не сохраняет новую
ревизию и сейчас выполняется заново при каждом чтении.

**GEOM-06. Границы validation.** Обычные resource mutations проверяют доменные
ссылки/инварианты; полная численная compilation не является обязательной частью
каждой правки. Сейчас add spiral и итог agent turn компилируют draft до commit;
add spline может сохраниться, а численная ошибка обнаружится при compiled read.
Перевод всех mutations на обязательную compilation требует отдельного решения.

## 8. Библиотека и облака проекта

**LIB-01. Загрузка.** Жизненный цикл: create upload → PUT bytes по `upload_url` →
complete → ready. Creation принимает `name` (1–200 символов, после trim не пустое),
`size_bytes` и `format` (`ply` по умолчанию, также `sog`), создаёт pending asset с
серверным ключом `<id>.<format>`. Текущий предел заявленного размера —
`2,147,483,648` байт (2 GiB); значение положительное. Pending asset не входит в
публичный list/get ready assets и не может стать экземпляром проекта.

**LIB-02. Завершение.** Complete проверяет наличие файла, точное совпадение размера
и container signature: первые четыре байта PLY — `ply\n` или `ply\r`, SOG —
`PK\x03\x04`. Это проверка контейнера, не полное декодирование формата. Невалидный
файл остаётся pending, ответ `422`. Успешный complete публикует ready asset;
повторный complete ready asset возвращает тот же ресурс.

**LIB-03. Storage.** Доменная операция использует общий LibraryStorage contract:
upload/download URL, inspection/finalization, staged deletion. URLs вычисляются
adapter при чтении; в БД сохраняется object key, а не временный URL.

- Local: editor-only streaming PUT во временный файл; превышение заявленного размера
  даёт `413`, неполная загрузка — `422`, временный файл очищается; готовый файл
  заменяется атомарным rename. Public GET отдаёт только ready content.
- S3: private bucket, expiring presigned PUT/GET (default TTL 300 секунд).
  PUT пишет в `_uploads/`, complete проверяет size/signature и продвигает именно
  проверенный объект с ETag precondition в ready namespace. Старый upload URL не
  перезаписывает ready object. Повтор после promotion/SQL failure может восстановить complete.

**LIB-04. Удаление.** Single/bulk delete проверяют всю выборку перед изменениями;
дубли ID в bulk объединяются. Удаляются asset records, bytes и все их cloud instances.
Ревизия каждого затронутого проекта повышается один раз на batch; остальные его
ресурсы сохраняются, cloud ordering уплотняется. Неизвестный выбранный ID даёт `404`
без частичного удаления. Уже отсутствующие bytes не мешают удалить запись.
Storage staging охватывает SQL commit: при ошибке bytes восстанавливаются; после
commit временные backups очищаются. При невозможности restore backups сохраняются
для восстановления; это не распределённая транзакция с гарантией от любого crash.

**LIB-05. Defaults.** Asset хранит finite Euler XYZ `default_rotation_deg`, positive
`default_scale`, finite `default_offset`. PATCH требует rotation и scale; пропущенный
offset сохраняет старый. Изменение defaults влияет только на **новые** cloud instances.
Файл и уже созданные экземпляры не изменяются.

**CLOUD-01.** Один ready asset можно добавить в один/несколько проектов несколько раз.
Каждая операция создаёт отдельный instance ID, копирует текущие asset defaults,
принимает finite translation, ставит visible=true и добавляет в конец списка.
Файл не копируется. Instance удаляется отдельно от asset. Project reset/delete
удаляет instances, сохраняя общую библиотеку.

**CLOUD-02.** PATCH instance меняет `position` и/или `visible`; пустой patch
отклоняется. Position — индекс `0..count−1`; reorder сохраняет уникальный плотный
порядок. Сохранённые rotation/scale/offset выдаются в ответе, но их редактирование
через текущий cloud PATCH не поддерживается. Применение transform в renderer находится
за границей backend; расширение transform API относится к плану.

## 9. Авторизация и профиль

**AUTH-01.** Публичные GET читают общие данные; `GET /auth/session` требует Bearer.
Business writes, local upload, profile update и logout требуют действующей editor
session. Вход/verify/resend доступны без JWT. Единственный editor создаётся/заменяется
через `editor-create` с email и паролем длиной 12–1024; публичной регистрации нет.
Пароль хранится Argon2 hash. Замена credentials отзывает сессии и незавершённые входы.

**AUTH-02.** В обычном режиме login проверяет email/password и возвращает
`{challenge_id, expires_in, resend_after}`, затем verify потребляет шестизначный
email code и создаёт сессию. Срок кода — 300 секунд, максимум 5 проверок challenge;
resend возможен через 60 секунд, заменяет код и срок, но не сбрасывает attempts.
Успешный code потребляется один раз; конкурирующие verify не создают две сессии.
Доставка идёт на сохранённый editor email. Неуспешная доставка не активирует challenge
и не выдаёт token. Пароли, codes и JWT не включаются в логи.

**AUTH-03.** Бюджеты фиксированных окон хранятся в БД и переживают рестарт:
10 password attempts/min, 30 code checks/min, 5 sends/min и 20 sends/hour.
Проверяются account и immediate-peer source budgets; произвольный X-Forwarded-For
не считается достоверным адресом клиента. Throttling возвращает `429`/`Retry-After`.

**AUTH-04.** Verify возвращает `{access_token, token_type:"bearer", expires_in}`.
JWT использует HS256, issuer `camera-path`, audience `camera-path-api`, subject editor,
credential version и session ID. Проверяются signature, required claims, expiry,
активная DB session и email authentication mode. Default TTL — 28,800 секунд,
допустимо 60–86,400. Refresh token нет. Logout отзывает текущую сессию; replay token
после logout не проходит. Для signing требуется секрет минимум 32 байта; при его
отсутствии login/authenticated access недоступны, public reads продолжают работать.

**AUTH-05.** Явный development `auth_second_factor=off` оставляет email/password,
но login сразу возвращает token и не отправляет почту. Такой token не принимается
в email-mode. Production требует email second factor и SES; off/SMTP в production
отклоняются конфигурацией. Browser Next.js proxy хранит JWT в HttpOnly SameSite=Strict
cookie (Secure в production), проверяет Origin для browser writes и добавляет Bearer;
raw token не является частью browser storage/UI. Это интеграционный контракт с frontend.

**PROFILE-01.** Общий профиль хранится под configured `dev_user_id` (default
`dev-user`), независимо от projects и JWT username. GET публичный, PATCH editor-only.
Defaults: `webgpu_tile_renderer=false` (Spark/WebGL), `show_grid=true`,
`gaussian_dpr="1x"`; DPR допускает также `system`. PATCH частичный, booleans строгие,
неизвестные поля отклоняются; omitted fields сохраняются. Preferences переживают
рестарт, reset/delete проекта и не изменяют его ревизию.

## 10. Чат и агент

**CHAT-01.** Запрос — `{id, message}`, message длиной 1–10,000; при отсутствии ID
генерируется UUID. User message сохраняется **до** обращения к модели и проверки
её доступности. Повтор ID с той же role/content не создаёт сообщение/ревизию;
другой content/role с тем же ID даёт `409 chat_message_conflict`. Это идемпотентность
сохранения сообщения, не гарантия однократного выполнения всего LLM turn.

**CHAT-02.** Агент передаёт сохранённую историю и системные инструкции в OpenAI
Responses API. Максимум 12 rounds, `parallel_tool_calls=false`; полученные calls
выполняются последовательно над draft. Каждый call выполняется на копии draft и
валидируется; неудачный call возвращает модели error и не оставляет частичные edits.
Tool edits не сохраняются по отдельности. Финальный ответ и все успешные edits
компилируются и сохраняются одной project revision с optimistic revision check.

**CHAT-03.** Текущий набор tools:

| Область | Команды |
| --- | --- |
| Чтение | `get_project_state` (anchors, scene_points, segments, motion_profile, camera_track) |
| Путь | `create_spline`, `create_spiral`, `delete_segment` |
| Точки сцены | `create_scene_point`, `update_scene_point`, `delete_scene_point` |
| Скорость | `set_default_speed`, `create_speed_keyframe`, `update_speed_keyframe`, `delete_speed_keyframe` |
| Aim | `create_camera_keyframe`, `update_camera_keyframe`, `delete_camera_keyframe` |
| Ориентация | `create_camera_orientation_keyframe`, `update_camera_orientation_keyframe`, `delete_camera_orientation_keyframe` |
| DOF | `create_depth_of_field_keyframe`, `update_depth_of_field_keyframe`, `delete_depth_of_field_keyframe` |
| LiDAR | `set_lidar_timeline`, `delete_lidar_timeline` |

Создание/перемещение anchors, library/cloud operations, project rename/reset/delete,
undo/redo и изменение default aim/orientation сейчас не доступны как tools.
Модель выбирает команду; backend исполняет её детерминированно и проверяет доменные правила.

**CHAT-04.** При отсутствии API key ответ `503`; provider failure обычного chat —
`502`. User message сохраняется и при неудачном turn. Если final validation/compile
или revision check не прошли, assistant message и tool edits не фиксируются.
Нет транзакции БД, удерживаемой на время всей работы модели. Формат ответа успешного
canonical chat — `{answer, compiled}`, ETag соответствует итоговой ревизии.

**CHAT-05. SSE.** POST stream потребляется streaming fetch, не обычным EventSource.
Content-Type — `text/event-stream`, buffering отключено, Cache-Control=no-cache.
Каждое событие имеет `event: <name>`, JSON `data: ...` и пустую строку-разделитель:

| event | data | Смысл |
| --- | --- | --- |
| `delta` | `{text}` | Предварительный текст, не подтверждение сохранения |
| `result` | `{answer, compiled}` | Turn сохранён; читать revision из compiled и обновить ресурсы |
| `error` | `{code:"stream_error", detail}` | Ошибка после начала ответа; успешный commit не подтверждён этим событием |

Tool outputs возвращаются модели и не являются отдельными публичными SSE events.
Сохранение user message перед стартом стрима идемпотентно при повторном внутреннем
вызове. Нынешний chat stream не имеет event IDs/replay и не является будущим stream
событий библиотеки/генерации. Обрыв клиентского соединения сам по себе не гарантирует
rollback уже сохранённых данных или отмену provider request.

## 11. Хранение, конфигурация и эксплуатация

**STORE-01.** Основное хранилище — SQLite через async SQLAlchemy; schema migrations —
Alembic. Действующий migration head: `20261026_0014`. Текущее состояние нормализовано
в typed columns; численные векторы не сериализуются как непрозрачные JSON blobs.
Foreign keys включены. Project aggregate собирается для совместимости; история полных
снимков с undo/redo больше не является действующей моделью хранения.

| Группа | Таблицы |
| --- | --- |
| Project / scene | `projects`, `anchors`, `scene_points`, `trajectory_segments`, `segment_anchors` |
| Controls | `motion_profiles`, `speed_keyframes`, `camera_tracks`, `aim_keyframes`, `orientation_keyframes`, `depth_of_field_keyframes`, `lidar_keyframes` |
| Library | `library_assets`, `project_clouds` |
| Chat / profile | `chat_messages`, `user_settings` |
| Auth | `editors`, `editor_sessions`, `auth_challenges`, `auth_rate_limits` |

**STORE-02.** Операция изменяет нужный ресурс, сохраняет unrelated rows и ссылки,
сохраняет order и проверяет revision в той же транзакции. Чтение не создаёт недостающие
domain records. Миграции сохраняют IDs, связи, файлы и existing preferences; смена
default не должна переписывать явно сохранённый пользовательский выбор. Startup
`create_all` для отсутствующих таблиц не заменяет upgrade существующей схемы.

**OPS-01.** Главные настройки задаются env/локальным `.env`; секреты не коммитятся.

| Настройка | Назначение / default |
| --- | --- |
| `CAMERA_PATH_DATABASE_URL` | `sqlite+aiosqlite` DB, по умолчанию `~/.camera-path/camera_path.sqlite3` |
| `CAMERA_PATH_LIBRARY_DIRECTORY` | Local bytes, по умолчанию `~/.camera-path/library` |
| `CAMERA_PATH_AWS_LIBRARY_STORAGE` | `local` / `s3`, default `local` |
| `CAMERA_PATH_AWS_S3_BUCKET`, `CAMERA_PATH_AWS_S3_PREFIX` | Bucket обязателен для S3; default prefix `library/` |
| `CAMERA_PATH_AWS_S3_URL_TTL_SECONDS` | 300, допустимо 60–3600 |
| `CAMERA_PATH_COMPILE_TOLERANCE` | Положительное значение, default `0.001` |
| `CAMERA_PATH_CORS_ORIGINS` | Список origins через запятую, default localhost/127.0.0.1:3000 |
| `CAMERA_PATH_JWT_SECRET`, `CAMERA_PATH_JWT_TTL_SECONDS` | Signing secret / срок сессии |
| `CAMERA_PATH_ENVIRONMENT` | `development` / `production` |
| `CAMERA_PATH_AUTH_SECOND_FACTOR`, `CAMERA_PATH_AUTH_EMAIL_DELIVERY` | Default `email` / `smtp`; production требует `email` / `ses` |
| `CAMERA_PATH_AUTH_EMAIL_FROM`, `CAMERA_PATH_AUTH_SMTP_HOST`, `CAMERA_PATH_AUTH_SMTP_PORT` | Sender / loopback SMTP host / default port 1025 |
| `OPENAI_API_KEY`, `CAMERA_PATH_OPENAI_MODEL` | Optional chat key / default model `gpt-5.6-luna` |
| `CAMERA_PATH_DEV_USER_ID` | Ключ shared profile, default `dev-user` |

AWS adapter использует configured region/profile или стандартную credentials chain;
конкретные credentials не являются частью спецификации. S3/SMTP/SES выбираются в
composition root, а операции проектов не зависят от способа доставки bytes/почты.

**OPS-02.** `/health` возвращает `{status:"ok"}` и является liveness endpoint,
не полной проверкой БД/S3/SES/OpenAI. `/docs` показывает Scalar, OpenAPI доступен по
`/api/v1/openapi.json`. Текущая инфраструктура в `infra/`: EC2 с Nginx/HTTPS и loopback
Uvicorn, отдельный persistent EBS для SQLite, private S3 library и backup bucket,
Secrets Manager и SSM. Точный topology/config/release runbook находится в
[infra/README.md](infra/README.md).

**OPS-03.** Code release выбирает точный опубликованный commit, сохраняет стабильный
AMI и существующие data resources. Release останавливает writer, делает проверенный
SQLite backup, применяет миграции, проверяет health; failure path восстанавливает
предыдущую БД/версию согласно runbook. Обычная смена кода или языка backend не должна
требовать замены EC2/EBS/S3. Этот документ и PR с ним не выполняют production deployment.

## 12. Реестр HTTP-операций

**HTTP-01.** Ниже перечислены все 70 операций текущего checked-in OpenAPI. Все пути
содержат `/api/v1`. Имена request/response DTO соответствуют схемам в
[backend/openapi.json](backend/openapi.json); их поля, required/nullability и точные
JSON shapes проверяются по этой машинной схеме вместе с правилами выше. `—` означает
отсутствие body. Успешный `204` не содержит JSON. Auth и project preconditions описаны
в `AUTH-01` и `API-02`; ошибки не ограничиваются успешными status из таблицы.

| Метод | Путь | Request body | Success → response |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login` | LoginRequest | 200 → TokenResponse / ChallengeResponse |
| `POST` | `/api/v1/auth/logout` | — | 204 → — |
| `POST` | `/api/v1/auth/resend` | ChallengeRequest | 200 → ChallengeResponse |
| `GET` | `/api/v1/auth/session` | — | 200 → SessionResponse |
| `POST` | `/api/v1/auth/verify` | VerifyRequest | 200 → TokenResponse |
| `GET` | `/api/v1/library` | — | 200 → LibraryAsset[] |
| `POST` | `/api/v1/library/bulk-delete` | LibraryAssetsDelete | 204 → — |
| `POST` | `/api/v1/library/uploads` | LibraryUploadCreate | 201 → LibraryUpload |
| `DELETE` | `/api/v1/library/{asset_id}` | — | 204 → — |
| `GET` | `/api/v1/library/{asset_id}` | — | 200 → LibraryAsset |
| `POST` | `/api/v1/library/{asset_id}/complete` | — | 200 → LibraryAsset |
| `PATCH` | `/api/v1/library/{asset_id}/defaults` | LibraryAssetDefaultsUpdate | 200 → LibraryAsset |
| `GET` | `/api/v1/profile/settings` | — | 200 → UserSettings |
| `PATCH` | `/api/v1/profile/settings` | UserSettingsUpdate | 200 → UserSettings |
| `GET` | `/api/v1/projects` | — | 200 → ProjectMetadata[] |
| `POST` | `/api/v1/projects` | ProjectCreate | 201 → ProjectMetadata |
| `DELETE` | `/api/v1/projects/{project_id}` | — | 204 → — |
| `GET` | `/api/v1/projects/{project_id}` | — | 200 → ProjectMetadata |
| `PATCH` | `/api/v1/projects/{project_id}` | ProjectUpdate | 200 → ProjectMetadata |
| `GET` | `/api/v1/projects/{project_id}/anchors` | — | 200 → Anchor[] |
| `POST` | `/api/v1/projects/{project_id}/anchors` | AnchorCreate | 201 → Anchor |
| `DELETE` | `/api/v1/projects/{project_id}/anchors/{anchor_id}` | — | 204 → — |
| `PATCH` | `/api/v1/projects/{project_id}/anchors/{anchor_id}` | AnchorUpdate | 200 → Anchor |
| `DELETE` | `/api/v1/projects/{project_id}/camera` | — | 204 → — |
| `GET` | `/api/v1/projects/{project_id}/camera` | — | 200 → AimTimeline |
| `PATCH` | `/api/v1/projects/{project_id}/camera` | CameraTrackUpdate | 200 → AimTimeline |
| `DELETE` | `/api/v1/projects/{project_id}/camera/depth-of-field` | — | 204 → — |
| `GET` | `/api/v1/projects/{project_id}/camera/depth-of-field` | — | 200 → DepthOfFieldTimeline |
| `POST` | `/api/v1/projects/{project_id}/camera/depth-of-field` | — | 200 → DepthOfFieldTimeline |
| `POST` | `/api/v1/projects/{project_id}/camera/depth-of-field/keyframes` | DepthOfFieldKeyframeCreate | 201 → DepthOfFieldKeyframe |
| `DELETE` | `/api/v1/projects/{project_id}/camera/depth-of-field/keyframes/{keyframe_id}` | — | 204 → — |
| `PATCH` | `/api/v1/projects/{project_id}/camera/depth-of-field/keyframes/{keyframe_id}` | DepthOfFieldKeyframeUpdate | 200 → DepthOfFieldKeyframe |
| `POST` | `/api/v1/projects/{project_id}/camera/keyframes` | CameraKeyframeCreate | 201 → CameraKeyframe |
| `DELETE` | `/api/v1/projects/{project_id}/camera/keyframes/{keyframe_id}` | — | 204 → — |
| `PATCH` | `/api/v1/projects/{project_id}/camera/keyframes/{keyframe_id}` | CameraKeyframeUpdate | 200 → CameraKeyframe |
| `DELETE` | `/api/v1/projects/{project_id}/camera/lidar` | — | 204 → — |
| `GET` | `/api/v1/projects/{project_id}/camera/lidar` | — | 200 → LidarTimeline |
| `PATCH` | `/api/v1/projects/{project_id}/camera/lidar` | LidarSettings | 200 → LidarTimeline |
| `DELETE` | `/api/v1/projects/{project_id}/camera/orientation` | — | 204 → — |
| `GET` | `/api/v1/projects/{project_id}/camera/orientation` | — | 200 → OrientationTimeline |
| `PATCH` | `/api/v1/projects/{project_id}/camera/orientation` | CameraOrientation | 200 → OrientationTimeline |
| `POST` | `/api/v1/projects/{project_id}/camera/orientation/keyframes` | CameraOrientationKeyframeCreate | 201 → CameraOrientationKeyframe |
| `DELETE` | `/api/v1/projects/{project_id}/camera/orientation/keyframes/{keyframe_id}` | — | 204 → — |
| `PATCH` | `/api/v1/projects/{project_id}/camera/orientation/keyframes/{keyframe_id}` | CameraOrientationKeyframeUpdate | 200 → CameraOrientationKeyframe |
| `DELETE` | `/api/v1/projects/{project_id}/chat` | — | 204 → — |
| `GET` | `/api/v1/projects/{project_id}/chat/messages` | — | 200 → ChatHistoryMessage[] |
| `POST` | `/api/v1/projects/{project_id}/chat/messages` | ChatMessage | 200 → ChatResponse |
| `POST` | `/api/v1/projects/{project_id}/chat/messages/stream` | ChatMessage | 200 → SSE |
| `POST` | `/api/v1/projects/{project_id}/chat/user-messages` | ChatMessage | 201 → ChatHistoryMessage |
| `GET` | `/api/v1/projects/{project_id}/clouds` | — | 200 → ProjectCloud[] |
| `POST` | `/api/v1/projects/{project_id}/clouds` | ProjectCloudCreate | 201 → ProjectCloud |
| `DELETE` | `/api/v1/projects/{project_id}/clouds/{cloud_id}` | — | 204 → — |
| `PATCH` | `/api/v1/projects/{project_id}/clouds/{cloud_id}` | ProjectCloudUpdate | 200 → ProjectCloud |
| `DELETE` | `/api/v1/projects/{project_id}/motion` | — | 204 → — |
| `GET` | `/api/v1/projects/{project_id}/motion` | — | 200 → MotionProfile |
| `PATCH` | `/api/v1/projects/{project_id}/motion` | MotionProfileUpdate | 200 → MotionProfile |
| `POST` | `/api/v1/projects/{project_id}/motion/keyframes` | SpeedKeyframeCreate | 201 → SpeedKeyframe |
| `DELETE` | `/api/v1/projects/{project_id}/motion/keyframes/{keyframe_id}` | — | 204 → — |
| `PATCH` | `/api/v1/projects/{project_id}/motion/keyframes/{keyframe_id}` | SpeedKeyframeUpdate | 200 → SpeedKeyframe |
| `POST` | `/api/v1/projects/{project_id}/reset` | — | 200 → ProjectMetadata |
| `GET` | `/api/v1/projects/{project_id}/scene-points` | — | 200 → ScenePoint[] |
| `POST` | `/api/v1/projects/{project_id}/scene-points` | ScenePointCreate | 201 → ScenePoint |
| `DELETE` | `/api/v1/projects/{project_id}/scene-points/{point_id}` | — | 204 → — |
| `PATCH` | `/api/v1/projects/{project_id}/scene-points/{point_id}` | ScenePointUpdate | 200 → ScenePoint |
| `POST` | `/api/v1/projects/{project_id}/segments/spiral` | SpiralSegmentCreate | 201 → SpiralSegment |
| `POST` | `/api/v1/projects/{project_id}/segments/spline` | SplineSegmentCreate | 201 → SplineSegment |
| `DELETE` | `/api/v1/projects/{project_id}/segments/{segment_id}` | — | 204 → — |
| `DELETE` | `/api/v1/projects/{project_id}/trajectory` | — | 204 → — |
| `GET` | `/api/v1/projects/{project_id}/trajectory` | — | 200 → Trajectory |
| `GET` | `/api/v1/projects/{project_id}/trajectory/compiled` | — | 200 → CompiledTrajectory |

**HTTP-02.** Дополнительные используемые маршруты, отсутствующие в OpenAPI:

| Метод и путь | Контракт |
| --- | --- |
| `GET /health` | Liveness, `200 {status:"ok"}` |
| `GET /docs` | Scalar HTML |
| `GET /api/v1/openapi.json` | Сгенерированный OpenAPI |
| `PUT /api/v1/library/{asset_id}/content` | Только local adapter, editor, raw bytes → `204`; без project If-Match |
| `GET /api/v1/library/{asset_id}/content` | Только local adapter, public ready bytes |

Unversioned project API монтируется из `routers/api.py`; его функции — compatibility
project/scene/trajectory/timeline/chat operations с aggregate ответами. Это не отдельная
новая модель данных. Наличие файла `routers/history.py` не означает доступность undo/redo.

## 13. Проверка соответствия

**CHECK-01.** Проверки должны утверждать поведение и последующее сохранённое состояние,
включая отсутствие частичных edits при ошибке. Обязательные сценарии и существующие
опорные тесты (пути относительно `backend/tests/`):

| Требования | Что проверять | Существующие тесты |
| --- | --- | --- |
| API-01–07, HTTP-01 | Resource shapes, ETag/If-Match, stale/missing/malformed revision, legacy compatibility, schema | `test_openapi.py`, `test_api.py` |
| PROJECT-01–02, SCENE-01–04, STORE-01–02 | CRUD, reset/clear distinctions, FK/cascade, unrelated data, restart | `test_api.py`, `test_resource_integrity.py`, `test_repository.py`, `test_migration.py`, `test_enum_columns.py` |
| TIME-01–05 | Defaults, duplicate positions, delete/recreate, static LiDAR singleton | `test_delete_timelines.py`, `test_depth_of_field_timeline.py`, `test_lidar_timeline.py` |
| GEOM-01–06 | Endpoints, C² spline, tangent constraints, unchanged spirals, adaptive approximation, distance/time | `test_geometry.py`, `test_trajectory_planner.py` |
| LIB-01–05, CLOUD-01–02 | Реальные маленькие PLY/SOG bytes, complete/retry, instances/defaults/order, delete rollback | `test_library.py`, `test_s3_library.py`, `test_project_clouds.py`, `test_library_delete.py`, `test_library_bulk_delete.py` |
| AUTH-01–05, PROFILE-01 | Email flow, invalid/replayed tokens, persistent attempts, concurrent verify, logout, partial settings | `test_auth.py`, `test_email_auth.py`, `test_user_settings.py`, `test_config.py` |
| CHAT-01–05 | Idempotent messages, atomic tool edits, history, SSE delta/result/error, unavailable provider | `test_agent.py`, `test_agent_lidar.py`, `test_api.py` |

Это карта проверки, а не заявление, что существующие тесты уже доказывают каждый
граничный случай. Зависимость от внешнего provider и качество LLM проверяются отдельно.
Введённый в PR тест должен проверять требование, а не повторять внутренний алгоритм.

**CHECK-02.** Для изменения Python-backend основной запуск из `backend/`:

```bash
uv sync --frozen --extra aws
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

При изменении HTTP schema: `uv run openapi-export openapi.json`, проверка актуальности
artifact и совместимости generated frontend API. Для чистой правки документации
достаточны сверка ссылок, таблицы операций/DTO и `git diff --check`; выполнение полного
runtime suite само по себе не проверяет достоверность прозы.

**CHECK-03.** Любая новая реализация backend сохраняет внешний контракт, права,
persisted data и семантику ревизий либо содержит явное согласованное изменение спеки.
Численные comparisons используют документированные допуски; совпадение JSON float
побайтно не требуется. Независимый HTTP acceptance suite CP-118 пока находится в
отдельном PR и станет дополнительной проверкой после принятия (раздел 15).

## 14. Ограничения и открытые вопросы

**GAP-01.** Спека фиксирует исходный контракт, но не объявляет известные баги желаемым
поведением. [CP-117](https://docs.google.com/document/d/1Ql-Ynh-PZ6QIVf6nqycBb2FExjOriIQZMlYG-2VFZmI/edit)
сообщает о revision_conflict при удалении anchor и повторном создании spiral.
Нужно отдельно локализовать backend/frontend причину; требование остаётся прежним:
актуальная ревизия допускает корректную правку, stale revision даёт конфликт без потери данных.

**GAP-02.** HTTP mutation guard использует lock внутри процесса, а DB write — revision
CAS. Это не обещание общей блокировки всех процессов или атомарного чтения нескольких
независимых HTTP resources. Долгий agent turn может конфликтовать с другой правкой;
клиент должен перечитать состояние. Бесконечный auto-retry LLM edits не задан.

**GAP-03.** Единообразный перевод всех ошибок LLM/compile/disconnect в non-stream JSON
и SSE error ещё не установлен. В частности, catch list stream не охватывает любой
возможный exception. Расширение error handling должно сохранять atomic commit semantics;
нельзя считать отсутствие `result` доказательством rollback при потере соединения.

**GAP-04.** Нет полного server-side parser/sha256 validation 3DGS, глобальной квоты
количества файлов и законченного lifecycle просроченных pending uploads. Текущий
2 GiB validation предел не равен будущему ограничению 1 GB, а S3 signed PUT сейчас
не предотвращает приём oversized bytes до complete. Новые квоты — `PLAN-03`.

**GAP-05.** Тексты старых документов/README могут отставать от контракта. В частности,
описания snapshot undo/redo, обязательного aim key в нуле, Catmull–Rom planner или
деформации analytic spirals на spline junction не задают текущую реализацию.
Внутренний Project не включает clouds; полноценный экспорт всего проекта, revisioned
library/profile, cloud transform editing, кэш compilation и multi-user access пока не заданы.

## 15. Запланированные изменения

Только этот раздел имеет статус **план / не входит в текущий контракт `main`**.
Состояние PR указано на дату первичной сверки; merge требует обновить статус и
перенести принятые требования в соответствующие основные разделы. Ссылки ведут к
подробным исходным карточкам, но не дают агенту задания реализовать их все сразу.

**PLAN-01. CP-118 — независимая HTTP-приёмка.**
[Карточка](https://docs.google.com/document/d/1CqaWyve6LW1tY7ra4lRSYRnQ8I9SzgVkSo-IgYPUaZM/edit),
[draft PR #111](https://github.com/vinneyto/camera_path/pull/111).
Настоящий backend process, изолированные SQLite/files, внешний SMTP/OpenAI fixture;
тот же suite применяется к Python и Rust. Матрица операций, concurrency, auth, SSE,
restart persistence и численные допуски. Моки внутренних прикладных операций не
заменяют acceptance; известные баги не превращаются в ожидаемое поведение.

**PLAN-02. CP-119 — Rust modular monolith.**
[Карточка](https://docs.google.com/document/d/1mUXqDCmQ0eoH06N66HiyUO1dvWkLKOgvz0Fnub7tEiY/edit),
[draft PR #112](https://github.com/vinneyto/camera_path/pull/112), основан на #111.
Выбранное направление: Axum/Tokio/Serde, SeaORM и migrations, Utoipa, сохранение
SQLite/API/data. Core **включает ORM, репозитории и бизнес-логику**, но не provider SDKs.
Отдельные crates: core, app, storage-local, storage-s3, email-smtp, email-ses,
queue-rabbitmq, queue-sqs и OpenAI adapter. App собирает окружение; adapters зависят
от core. HTTP и queue ingress вызывают прикладные операции одного монолита.
RabbitMQ для dev, SQS для AWS; ack после commit, durable deduplication, retries/DLQ.
Миграция Alembic → SeaORM валидирует исходную схему, сохраняет IDs/files/auth и
проверяется на копии БД; CPU-heavy work выносится с async runtime. Code release не
пересоздаёт инфраструктуру. Переход на Go из старой CP-81 не является параллельным планом.

**PLAN-03. CP-116 — квоты библиотеки.**
[Карточка](https://docs.google.com/document/d/1HRMzxC3fAD1d0cDFy-Oz6KrjU583ajUQaWtc7QVJ0B8/edit).
Конечный configurable count limit и per-file limit не выше **1,000,000,000 байт**.
Проверять declared/actual size, local и direct S3 upload; active reservations входят
в квоту, concurrency не обходит её, failed/expired uploads освобождают reservation.
Existing assets не удаляются автоматически при уменьшении лимита. Default count,
конкретный механизм ограничения S3 и error codes нужно выбрать при реализации.

**PLAN-04. CP-95 — метаданные и корреляция библиотеки.**
[Карточка](https://docs.google.com/document/d/1nj0kNZH98IlHocQ5TTRTtXX8YyVk7mykJw71JBFJCPI/edit).
Сохранить server primary key; добавить immutable globally unique в окружении
`client_id` UUID, nullable `thumbnail_key`, `tags` с finite limits/normalization.
Client ID можно выбрать заранее или получить от backend; старые записи backfill.
Повтор ID с тем же содержимым идемпотентен, несовместимый payload конфликтует.
Поиск по client_id и URL thumbnail через storage adapter. Это correlation ID ресурса,
не credential, job ID или event ID.

**PLAN-05. CP-96/97/99/100 — внешняя генерация и применение результата.**
Основа после CP-118/119. [Импорт](https://docs.google.com/document/d/1OGkAa-Njnym7wa0hK1-0PEkN1rKosziBrVypiX1OMXk/edit),
[jobs](https://docs.google.com/document/d/1sI5dwmDcSkOu-uuVOuf8KnV08Fl-KGjq7nCIgdKouAo/edit),
[привязка](https://docs.google.com/document/d/1cNRdEdnIj6JTDXkl_5iJ_yeh2Vst2ByfANiRpmFkC8k/edit),
[события](https://docs.google.com/document/d/1mhv3MM9jq8V3ZGt83zR840v-mE6q6enAnOyg6Ek31t0/edit).

- Производитель сначала сохраняет model/thumbnail bytes, затем immutable versioned
  ready manifest с client_id, model key, format, size/hash, title/tags и optional
  job_id/attempt_token. Import проверяет namespace, bytes, limits и идемпотентность.
- Generation job долговечен: queued → running → awaiting_import → succeeded,
  terminal failed/cancelled; lease/heartbeat/fencing защищают от устаревшей попытки.
  Worker Trellis остаётся внешним; inference не выполняется в browser HTTP request.
- Library result сопоставляется по client_id/актуальной попытке. Cloud attachment
  выполняется backend атомарно, один раз на job, с текущим transform маркера.
  Удалённые project/marker не восстанавливаются: item остаётся в библиотеке,
  attachment_status=target_missing. Связанный anchor не удаляется вместе с его ссылками.
- Изменение и durable event/outbox записываются одной транзакцией. Отдельный от chat
  SSE контракт включает event IDs, revision/cursor, reconnect/replay и resync при
  устаревшем cursor. Доставка повторяема, consumers дедуплицируют. Backend succeeded
  и готовность модели в browser renderer — разные состояния.

В старых CP-96/97 есть варианты отдельного importer/HTTP-hop и DB long-poll worker.
Более новое решение CP-119 переносит queue ingress и прикладную обработку внутрь
монолита. При реализации нужно согласовать эти варианты и конкретные schemas/маршруты;
эта спека не объявляет одновременно оба транспорта обязательными. Отдельные сервисы,
gRPC и Redis не добавляются автоматически. Ни jobs, ни manifest endpoint, ни event
stream пока не входят в реестр HTTP текущего backend.

## 16. Источники и карта реализации

Эта спека восстановлена по текущим routes, DTO, services, repositories, compiler,
миграциям и тестам `main`, с проверкой релевантных Drive-карточек. Ссылки на исходники
помогают найти реализацию, но не требуют сохранять конкретную структуру файлов при рефакторинге.

| Область | Исходники |
| --- | --- |
| HTTP composition / errors | [api.py](backend/src/camera_path/api.py), [routers/](backend/src/camera_path/routers/) |
| DTO и defaults | [models.py](backend/src/camera_path/models.py), DTO в services/library.py, services/project_clouds.py, services/user_settings.py, routers/auth.py |
| Прикладные операции | [services/](backend/src/camera_path/services/) |
| Revision CAS | [revisions.py](backend/src/camera_path/services/revisions.py), [dependencies.py](backend/src/camera_path/routers/dependencies.py) |
| ORM / repositories / migrations | [persistence/](backend/src/camera_path/persistence/), [repositories/](backend/src/camera_path/repositories/), [alembic/](backend/alembic/) |
| Геометрия | [trajectory/](backend/src/camera_path/trajectory/) |
| LLM orchestration / tools | [trajectory_agent.py](backend/src/camera_path/agent/trajectory_agent.py) |
| Local / AWS adapters | [dev/](backend/src/camera_path/dev/), [aws/](backend/src/camera_path/aws/) |
| Runbooks | [backend/README.md](backend/README.md), [infra/README.md](infra/README.md) |

[Старое описание backend на Drive](https://docs.google.com/document/d/1JdP6BxfQYExK8O_8P-zR2Y3KAyCSptPIslNsuulDEdg/edit)
полезно как история; его snapshot storage, стартовый aim key и карта исходников
устарели. [Папка задач](https://drive.google.com/drive/folders/1A5lVOLC88vFn6oN3XXWfNdSckLFRWeYQ)
остаётся планом работ. Новые принятые требования следует собирать здесь, чтобы для
следующей реализации не требовалось заново восстанавливать контракт из переписки и карточек.
