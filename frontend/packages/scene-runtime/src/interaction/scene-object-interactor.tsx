"use client";
import { useSceneInteraction } from "@camera-path/store";
import type {
  SceneObjectTransform,
  SceneObjectTransformInteraction,
} from "@camera-path/types/scene-object-transform";
import type { ComponentProps } from "react";
import type { Matrix4, Quaternion } from "three";
import { SceneObject } from "./scene-object";
import { Widgets } from "./widgets";

type SceneObjectInteractorProps = Omit<
  ComponentProps<typeof SceneObject>,
  "sceneObjectID" | "matrix" | "matrixAutoUpdate"
> & {
  model: SceneObjectTransform & { id: string };
  worldMatrix: Matrix4;
  parentMatrix: Matrix4;
  parentRotation: Quaternion;
  editable?: boolean;
  interaction?: SceneObjectTransformInteraction;
};

export function SceneObjectInteractor({
  model,
  worldMatrix,
  parentMatrix,
  parentRotation,
  editable = false,
  interaction,
  children,
  ...props
}: SceneObjectInteractorProps) {
  const { widget } = useSceneInteraction();
  return (
    <SceneObject
      {...props}
      sceneObjectID={model.id}
      matrix={worldMatrix}
      matrixAutoUpdate={false}
    >
      {(state) => (
        <>
          {children(state)}
          {editable && state.selected && interaction && (
            <Widgets
              sceneObjectID={model.id}
              mode={widget}
              transform={model}
              parentMatrix={parentMatrix}
              parentRotation={parentRotation}
              enabled={!interaction.pending}
              onStart={() => interaction.begin(model.id, model)}
              onChange={(value) => interaction.change(model.id, value)}
              onCommit={(value) => interaction.commit(model.id, value)}
              onCancel={() => interaction.cancel(model.id)}
            />
          )}
        </>
      )}
    </SceneObject>
  );
}
