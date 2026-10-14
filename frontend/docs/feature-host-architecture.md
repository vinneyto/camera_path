# Фичи и хост frontend camera_path (CP-80)

Источник решения: [CP-80](https://docs.google.com/document/d/1tIYboWpNQqHeR9MRoy-mcfQszNb1G2Wt-y6XnK1eO1w/edit). Эта реализация относится к frontend. Backend, OpenAPI endpoints и инфраструктура не меняются.

## Структура

| Путь                        | Ответственность                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app`                   | Совместимые с текущим Next/Vercel entrypoints: маршруты, layout, API proxy. Сохранены корень приложения, команды запуска и расположение `.next`. |
| `apps/host/src/composition` | Состав фич, разрешённые связи и проекции, сборка команд, настроек, сцены и таймлайнов.                                                           |
| `apps/host/src/runtime`     | Application/project lifecycle, связывание data/request ports с REST и платформой, вычисление общей позы камеры.                                  |
| `apps/host/src/adapters`    | REST-клиент, query cache, ETag/revision reconciliation, auth, preference persistence, ресурсные операции. Доступны хосту.                        |
| `packages/contracts`        | DTO из OpenAPI, схемы проверки, типизированные data/request/GPU определения и props вкладов.                                                     |
| `packages/extension-api`    | Ограниченный контекст, runtime проверки, immutable DTO, регистрация вкладов, кадры, GPU leases, command registry.                                |
| `packages/ui-kit`           | Общие примитивы, command palette, timeline stack, графическое размещение ключей. Нет импортов фич/хоста.                                         |
| `packages/scene-runtime`    | Renderer adapters, render pipeline, generic surface/picking и ресурсы Three.js.                                                                  |
| `packages/trajectory-math`  | Чистые функции геометрии, оценки ключей и отображения времени на путь.                                                                           |
| `packages/features/*`       | Manifest, локальные порты, компоненты и приватное состояние фичи. Опциональная регистрация сервисов.                                             |

Application-фичи: projects, library, identity, appearance, renderer-preferences и scene-grid (общая preference сетки; геометрия монтируется в сцене проекта). Project-фичи: scene-models, anchors, trajectory, speed-track, camera-aim, camera-orientation, depth-of-field, lidar, playback, camera-view. Scope проекта создаётся с ключом projectId. Детали library asset используют отдельную ограниченную route projection поверх application-адаптеров.

## Ревью потока данных

1. Прочитать `packages/features/<feature>/src/manifest.ts`: `calls`, `reads`, опциональный `handles`, frames, contributions и capabilities.
2. Перейти к объектам контрактов в `packages/contracts/src/{host-data,host-requests,gpu-resources}.ts`. `schema.parse` выполняет проверку; API DTO проверяются по JSON Schema из того же OpenAPI, что и generated TypeScript.
3. Прочитать локальные порты фичи: они вызывают объявленные actions и читают разрешённые данные. Контекст не содержит общего Project, REST-клиента, QueryClient или editor store. Обработчики actions и бизнес-логика подключены в хосте.
4. Проверить host bindings в `apps/host/src/runtime` и явные преобразования в `apps/host/src/composition`. Например, aim lane получает только scene-point labels и compiled aim; orientation и DOF не получают весь Project. Составной Project остаётся приватной проекцией оболочки хоста.
5. Открыть `docs/frontend-contract-graph.json`. Он генерируется из текстовых деклараций и фактических binding sites; ссылки на контракты нормализуются до канонических ID. Изменение деклараций без обновления графа отклоняется CI.

Манифест объявляет три направления доступа:

- `calls`: actions или операции, которые фича может вызвать.
- `reads`: данные, которые фича может читать. Один контракт разрешает `read`, `state`, `readAsync` и `subscribe`.
- `handles?`: сервисные операции, которые фича реализует для внешнего вызова. Отсутствие поля равнозначно пустому списку.

Например, appearance использует `reads: [themeState]` и `calls: [toggleTheme]`. Кнопка вызывает хостовый action, хост меняет тему и публикует новое значение. Все 17 текущих фич не предоставляют сервисных операций и не объявляют `handles`; неиспользуемые перенаправления и их дублирующие контракты удалены. Для будущего сервиса `register(host)` может подключить объявленный обработчик через `host.requests.handle`; хост активирует и освобождает такую регистрацию. ID сервиса принадлежит фиче, а вызывающий модуль должен объявить его в `calls`.

`read` синхронно возвращает готовое значение; loading/error доступны через `state`/`useDataQuery`. `readAsync` подписывается на уже зарегистрированный provider и ждёт готовности; если значение уже готово, возвращает его, а не ждёт следующего изменения. HTTP-запрос он не запускает; отсутствие provider является ошибкой. `subscribe` освобождается при dispose. React использует `useSyncExternalStore` и стабильную идентичность состояния до публикации следующего значения. DTO копируются и рекурсивно замораживаются; File и одноразовый callback принятия chat-запроса объявлены отдельно в request schemas и не попадают в data store.

Requests возвращают типизированный результат с ожидаемым кодом ошибки. Проверяются input/output, permission и право вызова. AbortSignal, timeout, logout и уничтожение scope завершают ожидание. Host adapters сохраняют существующий cache invalidation и If-Match механизм. Отмена ожидающего вызова не откатывает уже принятую сервером запись: её reconciliation выполняется по ресурсам соответствующего projectId.

Playback, camera mode и trajectory selection создаются отдельными feature controllers для каждого проекта. Хост держит их проекцию для платформенных hooks и координирует camera/tool arbitration и placement. Неиспользуемые DTO-публикации controllers и статуса LiDAR удалены; данные наружу предоставляет хост. Черновик чата и состояние редакторов остаются внутри своих компонентов; responsive-chat сохраняет один composer при смене раскладки. Фича может иметь приватный React/Zustand store на экземпляр; его внутренние изменения не требуют calls/handles или публикации данных.

Манифест описывает доступ через контракты. Некоторые scene/timeline inputs пока передаются хостом через props и не являются читателями host.data. Например, aimTimeline, chatHistory и trajectorySelection зарегистрированы в хосте, но их контрактные проекции не имеют читателей. Текущая смена схемы не переносит эти сценарии или владельцев состояния.

## Слоты и кадры

Settings sections и timeline lanes собираются через `ContributionRegistry`; команды публикуются фичей в command registry, а общую палитру рисует хост. Реестр сцены расположен в host composition, а camera/tool orchestration остаётся в отдельной оболочке сцены. Новый provider подключается в composition root; существующие feature packages не редактируются.

CPU frame registry проверяет before/after зависимости и циклы. `host.trajectoryCamera.update` вычисляет pose один раз в кадре; camera-view, DOF helper и LiDAR читают разрешённую проекцию с frameId/revision. Update/before-render выполняются до native renderer; after-render вызывается после отправки `RenderPipeline.render`, без обещания завершения GPU.

GPU-порты отделены от DTO. LiDAR получает ограниченный Gaussian scene view, публикует ranges и world-space hit buffer, имеет одного производителя на ID и generation leases. Невалидный или неготовый lease нельзя читать; release/renderer teardown инвалидируют leases. Текущий angular pass + hit reconstruction остаются атомарной реализацией sensor adapter: порядок Gaussian prepare → sensor render/compute → scene обеспечивается существующим native TSL/pipeline узлом. Этот рефакторинг не меняет ядра рендерера `3dgs-tile-webgpu`.

## Проверки

- `npm run boundaries:check`: feature → feature, private host, type-only/dynamic imports, re-exports, computed require/import, raw transport и общий query cache.
- `npm run graph:generate` / `npm run graph:check`: актуальность сериализованного графа.
- `npm run api:check`: generated DTO/client/schema соответствуют OpenAPI.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run format:check`.

Runtime tests проверяют denied access, duplicate providers, immutable snapshots, scope isolation, cancellation, deterministic frame order и GPU generations. Сохранены regression tests авторизации, preference reload, model placement/grid/Escape, trajectory/playback, chat layout, DOF и LiDAR resource lifetime. Реальное качество рендеринга и производительность на пользовательском GPU требуют отдельного прогона с настоящими моделями; сборка и CPU/WGSL тесты его не заменяют.
