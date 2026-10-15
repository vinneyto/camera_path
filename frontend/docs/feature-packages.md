# Пакеты frontend и типизированные слоты

Все пакеты находятся в одном репозитории и подключаются через npm workspaces.
Точка входа Next/Vercel остаётся в `frontend/src/app`; приложение живёт в `apps/host`.

## Зависимости и владение

| Пакет             | Ответственность                                                                      | Допустимые внутренние зависимости                                |
| ----------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `types`           | DTO Orval, типы редактора, траектории и UI                                           | Нет                                                              |
| `store`           | Vanilla Zustand store, selectors и контекст текущего project/asset                   | `types`                                                          |
| `api`             | HTTP-клиент, сессия, preferences, query hooks и ключи React Query                    | `types`, `store` для текущего ID                                 |
| `actions`         | Синхронные изменения Zustand и серверные mutations с invalidation и бизнес-эффектами | `store`, `api`, `types`, `trajectory-math`                       |
| `ui-kit`          | Общие визуальные компоненты, тема и editable-контекст                                | `types`                                                          |
| `trajectory-math` | Чистая математика траектории                                                         | `types`                                                          |
| `scene-runtime`   | Общие renderer adapters, viewport services, picking и R3F pose context               | `store`, `types`, `ui-kit`, `trajectory-math`, `render-pipeline` |
| `render-pipeline` | R3F Canvas, RenderPipeline, provider слоёв/эффектов и правила picking                | Нет                                                              |
| `commands`        | Панель команд, provider, компонент `Command` и типы команд                           | Нет                                                              |
| `slots`           | Общий интерфейс optional slots и простой React-монтаж                                | Нет                                                              |
| `features/*`      | Компоненты и приватное поведение одной фичи                                          | Общие пакеты; другие фичи и host запрещены                       |
| `apps/host`       | Providers, маршруты, layout и контейнеры слотов                                      | Общие пакеты и объекты слотов фич                                |

Хост создаёт `QueryClient`, а для каждого открытого проекта — отдельные `createEditorStore()`
и `createEditorActions(store)`. Они передаются обычным React providers. Zustand хранит
camera mode, playback, active tool, pending cloud и единые hovered/selected object IDs.
Данные сервера остаются в React Query; фичи читают их через API hooks, без второй копии в Zustand.
API provider сессии и preferences и provider темы монтируются на уровне приложения.

Фичи экспортируют один объект `slots`, проверенный через `satisfies FeatureSlots`. Он содержит
готовые React-компоненты без обязательных props. Каждый компонент сам вызывает
`useEditorStore`, `useEditorActions`, конкретные API/action hooks и `useTheme`. Он владеет
pending/error UI и приватными взаимодействиями. Внутри пакета его компоненты могут обмениваться
обычными props; ограничение относится к публичной границе host → feature.

## Фичи и места подключения

Общий пакет `@camera-path/slots` содержит `FeatureSlots`, `SlotName`, `SlotProvider` и `Slot`.
Интерфейс задаёт известные хосту секции и слоты; все поля, включая вложенные, опциональны.
Фича описывает только те места, которые использует. Например, entrypoint depth-of-field:

```tsx
export const slots = {
  project: { scene: [DepthOfFieldScene], commands: [DepthOfFieldCommands] },
  timeline: {
    tracks: [DepthOfFieldTimeline],
  },
} as const satisfies FeatureSlots;
```

Хост импортирует объекты в `apps/host/src/composition/feature-slots.ts` и передаёт массив в
`<SlotProvider features={featureSlots}>`. Его layout содержит только типизированные контейнеры:
`<Slot name="project.scene" />`, `<Slot name="settings.content" />`,
`<Slot name="dashboard.content" />` и аналогичные. Конкретные компоненты остаются приватными.
Для новой фичи достаточно добавить её объект в каталог; править каждый контейнер не требуется.
Опечатки в именах и компоненты с обязательными props отклоняются TypeScript.

Порядок компонентов внутри каждого слота: сначала порядок фич в статическом каталоге,
затем порядок компонентов в массиве самой фичи. Каталог не меняется в течение жизни приложения.
Пустые/необъявленные слоты ничего не рендерят. `Slot` не добавляет DOM/Three.js-обёрток;
mount/cleanup выполняет React. Данные и действия не передаются через объект слотов.
Манифестов, IDs, прав, request dispatcher, register/activate и динамического реестра фич нет.

| Контейнер хоста              | Компоненты фич                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Страница проектов            | `ProjectsContent`                                                                                                   |
| Страница библиотеки / модели | `LibraryContent`, `LibraryDetails`                                                                                  |
| Header controls              | `ProfileControl`, `ThemeToggle`                                                                                     |
| Settings modal               | `RendererSettings`, `GridSettings`                                                                                  |
| Project root                 | `PlaybackLoop`                                                                                                      |
| Project header status        | `AnchorStatus`, `TrajectoryStatus`                                                                                  |
| Command palette              | `ProjectCloudCommands`, `DepthOfFieldCommands`, `LidarCommands`                                                     |
| Project sidebar              | `ChatSidebar`                                                                                                       |
| Canvas scene                 | `CameraViewScene`, `SceneGrid`, `SceneModels`, `AnchorsScene`, `TrajectoryScene`, `DepthOfFieldScene`, `LidarScene` |
| Scene hints / toolbar        | `AnchorHint`, `CloudPlacementHint`, `CameraViewToolbar`                                                             |
| Timeline controls            | `PlaybackControls`                                                                                                  |
| Timeline tracks              | `SpeedTimeline`, `CameraAimTimeline`, `CameraOrientationTimeline`, `DepthOfFieldTimeline`, `LidarTimeline`          |

В `apps/host/src/ui/scene-editor/ui/scene-contents.tsx`:

```tsx
<TrajectoryPoseProvider trajectory={trajectory}>
  <Slot name="project.scene" />
</TrajectoryPoseProvider>
```

Provider — общая инфраструктура. Фичи не получают `trajectory` и callbacks через props.
`trajectory-panel-slot.tsx` содержит контейнеры `timeline.controls` и `timeline.tracks`; хост по-прежнему владеет общим layout и условиями отображения панелей.
Фичи импортируют из slots-пакета только типы и не монтируют компоненты других фич.

## Команды и жизненный цикл

`@camera-path/commands` — общий пакет приложения, доступный хосту и фичам.
Он владеет типами команд, регистрацией, `CommandsProvider`, поиском и отрисовкой palette.
Он не зависит от host, фич, store или API; получает поведение через callbacks.
Хост монтирует `project.commands` внутри `CommandsProvider`:

```tsx
<CommandsProvider>
  <Slot name="project.commands" />
</CommandsProvider>
```

Компоненты фич возвращают один `Command` или несколько команд во фрагменте:

```tsx
import { Command } from "@camera-path/commands";

function ProjectCloudCommands() {
  const placement = useCloudPlacement();
  return (
    <Command
      id="scene-models.cancel-placement"
      label="Cancel cloud placement"
      onSelect={() => placement.cancel()}
    />
  );
}

export const slots = {
  project: { commands: [ProjectCloudCommands] },
} as const satisfies FeatureSlots;
```

`Command` не создаёт DOM: внутри он регистрирует свои props в ближайшем provider.
При изменении props обновляются данные и callbacks, при unmount команда удаляется.
Provider объединяет команды всех фич и рендерит единственный palette. Поиск идёт по
`label`/`searchText`, выбор вызывает `onSelect` или `onSelectItem` для списка `items`.
`disabled` блокирует отдельную команду; `loading`, `error`, `emptyMessage` описывают
загрузку списка, `actionError` показывает ошибку выполнения под palette.

ID уникален внутри provider; используйте префикс фичи. Конфликты отклоняются явно.
Обновления сохраняют порядок смонтированных команд. Реестр локален provider и поддерживает
Strict Mode replay. Фичи управляют API-запросами, доступностью и обработчиками; host не передаёт
им props. Данные команд не хранятся в объекте слотов. Добавление DOF и LiDAR также выполняется через команды: меню «Add effect» удалено.
Lifecycle-хук остаётся деталью пакета
`commands`; фичам не нужно писать свои эффекты регистрации. Это тот же принцип, что у render passes.

## Сцена и жизненный цикл

Фичи могут использовать `useFrame`. Общая pose траекторной камеры вычисляется один раз перед
потребителями с priority `-2`; управление камерой, DOF helper и LiDAR читают её из ref с priority `-1`.
Это обычный R3F context, без собственного планировщика кадров.

`@camera-path/render-pipeline` — общий пакет приложения, независимый от host, фич и renderer adapters.
Он содержит `RenderPipelineCanvas`, `RenderPipelineProvider`, `useRenderPipeline`,
`useOptionalRenderPipeline`, типы регистрации, композитинг, константы слоёв и правила picking.
Внешние зависимости — только React, R3F и Three.js. Хост импортирует Canvas напрямую из пакета;
Canvas создаёт WebGPU renderer и монтирует provider внутри R3F. Старых re-export через
`scene-runtime/three` нет.

Фичи и Gaussian adapter получают сервис через `useRenderPipeline`/`SceneRenderPipeline`:
`registerLayer`, `registerEffect`, `registerAfterRender`, `getOpaqueViewDepth`.
Регистрация возвращает cleanup; владельцы пасов создают и освобождают свои ресурсы.
Provider владеет базовыми scene passes и финальным `RenderPipeline.outputNode`, применяет
зарегистрированные layers/effects в порядке `order` и выполняет рендер через `useFrame` с priority `1`.
Создание/освобождение pipeline и базовых passes остаётся в одном layout effect.
Конкретные Gaussian/LiDAR passes, worker и renderer-specific поведение остаются в `scene-runtime`
и соответствующих адаптерах. Создание LiDAR sensor остаётся в renderer adapter. Ресурсы сенсора создаются и освобождаются в одном effect,
включая replay Strict Mode и смену разрешения.

Общие viewport services предоставляют поверхность для picking, события OrbitControls,
bounds/framing, request depth, cursor, сообщения и context menu. Облака и сетка публикуют surface
hits, anchors обрабатывает их. Это связь с нейтральным viewport, без импорта реализации другой фичи.
Сервисы не регистрируют фичи и не выбирают, какие компоненты монтировать.

При удалении якоря actions очищают только его hover/selection с `ifCurrentId`.
Удаление траектории очищает её selection/hover и сбрасывает playback. Успешный чат выбирает
построенную траекторию. Scope проекта задаётся provider и проверяется при явном ID.
Ключ страницы по project ID создаёт новый store/actions при переходе к другому проекту.

## Проверки

`npm run boundaries:check` анализирует статические, type-only, re-export, dynamic и require imports,
проверяет отсутствие циклов между пакетами и запрещает host → feature implementation imports.
Host может импортировать только объекты `slots` в единственном каталоге. Публичные entrypoints
фич экспортируют только `slots`; runtime слотов остаётся у хоста. Проверки типов дополнительно
проверяют неизвестные пути, опечатки и обязательные props компонентов. Интеграционные тесты
проверяют порядок, пустые слоты, доступ к provider-данным, сохранение mount и cleanup,
а также реальное добавление/удаление DOF через слоты и общий API/cache.
Тесты могут собирать providers и использовать private implementation своей проверяемой фичи.

```bash
npm ci
npm run api:check
npm run boundaries:check
npm run typecheck
npm run lint
npm test
npm run build
npm run format:check
```

Начать ревью: `store/src/editor-store.ts`, `actions/src/create-editor-actions.ts`,
`api/src/resources`, `slots/src/feature-slots.ts`, затем `apps/host/src/composition/feature-slots.ts`,
`apps/host/src/providers` и публичные `features/*/src/index.ts`.
