# Фичи и хост frontend camera_path (CP-80)

Источник решения: архитектурное описание CP-80. Изменения относятся к frontend; backend, OpenAPI endpoints и инфраструктура сохраняются.

## Граница расширения

Каждая фича — закрытый модуль. Её `src/index.ts` экспортирует только `extension`: манифест, список вкладов `{ id, Component }` и опциональную регистрацию сервисов. Hooks, controllers, track factories и компоненты деталей остаются приватными. Рабочий код хоста импортирует descriptors только в двух каталогах `apps/host/src/composition/application-features.ts` и `project-features.ts`. Каталоги не адаптируют inputs фич и не вызывают их hooks.

`ExtensionProvider` регистрирует единый набор вкладов на lifetime application/project scope. `ExtensionSlot` получает только имя слота, сортирует вклады по общему order/ID и монтирует их компоненты без специализированных props. Вклады application и project объединяются с сохранением общего порядка. Компонент фичи самостоятельно читает разрешённые данные, вызывает actions и хранит состояние UI. Добавление фичи требует её включения в каталог; контейнеры слотов и существующие фичи не меняются.

Манифест описывает доступ к хосту:

- `calls`: actions или операции, которые фича может вызвать.
- `reads`: данные, которые фича может читать, включая snapshot, readiness и subscribe.
- `handles?`: сервисные операции, которые фича предоставляет. Текущие фичи не имеют handles; неиспользуемые forwarding handlers удалены.

Хост реализует бизнес-операции и публикацию data contracts. Владение REST/query cache, авторизацией, preferences и playback/camera state остаётся в host adapters/runtime. Хост может координировать общие workflows через контракты, но UI-контейнеры не собирают поведение конкретных фич. Фича может иметь собственный приватный React/Zustand store.

## Структура

| Путь                        | Ответственность                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/app`                   | Next/Vercel entrypoints, маршруты и API proxy.                                                            |
| `apps/host/src/composition` | Два каталога единых descriptors.                                                                          |
| `apps/host/src/runtime`     | Scope lifecycle, data/request bindings, REST adapters и общая поза камеры.                                |
| `apps/host/src/ui`          | Размещение универсальных слотов, canvas, навигация и общая оболочка.                                      |
| `packages/contracts`        | Валидируемые data/request/GPU контракты и общие DTO.                                                      |
| `packages/extension-api`    | Scoped host API, тип Extension, регистрация/монтирование вкладов, общие slot shells, frames/GPU/commands. |
| `packages/ui-kit`           | Общие UI-примитивы, modal, timeline axis и generic lane rendering.                                        |
| `packages/scene-runtime`    | Renderer adapters и общие сервисы viewport/поверхностей.                                                  |
| `packages/trajectory-math`  | Чистые геометрические и временные преобразования.                                                         |
| `packages/features/*`       | Манифест, descriptor, приватные компоненты/порты/состояние.                                               |

## Вклады UI

Таймлайны camera-aim, orientation, speed, DOF и LiDAR регистрируют самостоятельные компоненты в `timeline.tracks`. Состояния mutations, подтверждение удаления и ошибки принадлежат соответствующей фиче. DOF/LiDAR регистрируют собственные пункты `timeline.effects` и определяют их доступность. Общий TimelineStack знает только ось pathPosition, scrub и children; он не знает виды фич.

Фича trajectory монтирует собственную панель в `scene.overlay` и размещает внутри универсальные слоты controls/tracks/effects. Playback предоставляет `timeline.controls` и `project.root`; он самостоятельно подписывается на compiled trajectory и playback state. `seekPlayback` пересчитывает положение в elapsed через текущий motion profile в хосте.

Chat-agent владеет composer, чтением anchors/history, отправкой и pending/error UI в `project.sidebar`. Sidebar монтируется без привязки к авторизации в оболочке; фича сама решает, когда возвращать UI. Ширина/строки layout зависят от наличия содержимого слота. Projects/library реализуют свои content/details slots и самостоятельно выполняют операции. Header/status, настройки, подсказки и команды также подключаются через общие слоты. SettingsMenu содержит только slot shell; ошибки и сохранение preferences отображает фича renderer-preferences.

## Сцена и кадры

SceneContents монтирует `scene.root` и предоставляет renderer/environment services. Фичи anchors, scene-models, grid, trajectory, camera-view, DOF и LiDAR самостоятельно собирают свои сцены. Хост не создаёт marker props и не передаёт callbacks вроде onAddAnchor/onSetLidar/onDeleteDepthOfField.

Общие scene services предоставляют backend, environment, bounds/framing, camera target, bottom inset и запрос depth resources. Viewport services предоставляют context menu, сообщения загрузки/ошибок, cursor и event bus. События surfacePointerDown/Move/Up/Out/Cancel и controlsChange/Start не содержат ссылок на фичи. Grid/cloud surfaces публикуют события; anchors подписывается на них через общий сервис. Cloud placement выполняет raycast через платформенный picking API. Фичи не импортируют друг друга. Регистрации, сообщения, cursor, listeners и GPU resources освобождаются при cleanup соответствующего компонента/scope.

CPU frame registry проверяет порядок и циклы. Хост вычисляет trajectoryCameraPose один раз за кадр; camera-view, DOF helper и LiDAR читают разрешённую проекцию с frameId/revision. after-render выполняется после отправки RenderPipeline.render, без обещания завершения GPU.

GPU-порты отделены от DTO. LiDAR читает ограниченный Gaussian scene view и публикует ranges/hit instances через generation leases. Неготовые и инвалидированные leases нельзя читать. Gaussian prepare → sensor render/compute → scene остаются частью native pipeline; ядра `3dgs-tile-webgpu` не меняются. WebGPU — поддерживаемый путь; Spark/WebGL остаётся примером адаптера без требования feature parity.

## Контракты и runtime

Каждый host data/request объявлен в отдельном файле под `packages/contracts/src/host-data` или `host-requests` и экспортирован через index.ts. Второй аргумент defineDataContract/defineRequest — обязательное краткое английское описание.

Frontend JSON Schema генерируются из TS через закреплённый ts-json-schema-generator 2.9.0. HostSchemaTypes связывает имена с типами; generatedSchema выводит тип результата и использует committed JSON Schema 2020-12. Диапазоны, integer и tuple ограничения задаются TS/JSDoc. API DTO сохраняют OpenAPI refs и API validation. Типы сериализованных response views отражают defaults, которые Pydantic включает в ответ. File/callback inputs имеют отдельные runtime validators.

read возвращает готовое значение синхронно. readAsync ждёт готовности уже зарегистрированного provider, а не следующего события или HTTP-запроса. Отсутствие provider — ошибка. useDataQuery предоставляет loading/error; subscribe освобождается при dispose. DTO копируются и рекурсивно замораживаются.

Requests проверяют canonical contract, declarations, input/output/error schemas и права. AbortSignal, timeout, logout и уничтожение scope завершают ожидание. Отмена ожидания не откатывает уже принятую сервером запись: host adapters сохраняют resource/revision reconciliation и If-Match.

## Hover и выбор

sceneInteraction хранит один hoveredObjectId и один selectedObjectId независимо, на проект. Якорь имеет ID anchor:<anchorId>, траектория — trajectory. Общие hoverObject/selectObject принимают id; null очищает состояние. ifCurrentId выполняет атомарную условную очистку и защищает от запоздалого pointer-out/удаления другого объекта. Выбор якоря заменяет выбор траектории. Нажатие на пустое место без активного инструмента снимает выбор; выход из viewport очищает hover.

## Ревью и проверки

1. Прочитать manifest.ts: reads/calls/handles, slots, frames и GPU declarations.
2. Прочитать extension.ts: какие приватные компоненты монтируются.
3. Прочитать компонент вклада: его SDK reads/calls и приватный UI state.
4. Прочитать host bindings: бизнес-операции, адаптеры и публикации.
5. Открыть docs/frontend-contract-graph.json: schemaVersion 3 содержит permissions, bindings и slot topology.

- boundaries:check запрещает feature → feature, private host/raw transport/query cache и импорты реализации фич из хоста; entrypoint может экспортировать только descriptor.
- graph:check проверяет актуальность графа и соответствие реализованных вкладов манифесту.
- api:check и schemas:check проверяют актуальность generated API и frontend schemas.
- typecheck, lint, test, build, format:check и git diff --check выполняются перед публикацией.

Тесты включают неизвестный хосту timeline/overlay/sidebar, порядок application/project вкладов, cleanup и undeclared registration; реальный DOF add/delete через host API и обновления data cells; anchor placement через нейтральные surface events; прежние auth/preferences, placement, frame/GPU, timelines и renderer regression tests. Визуальное поведение и производительность WebGPU требуют отдельного прогона с настоящими моделями на пользовательском GPU.
