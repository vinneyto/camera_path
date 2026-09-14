"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { dof } from "three/addons/tsl/display/DepthOfFieldNode.js";
import { useLayoutEffect, useRef } from "react";
import { MathUtils, Raycaster, Vector2, Vector3 } from "three";
import { perspectiveDepthToViewZ, uniform } from "three/tsl";
import { PerspectiveCamera, type Node } from "three/webgpu";

import type { ResolvedDepthOfFieldFocus } from "@/entities/trajectory";

import { CENTER_WEIGHTED_AUTOFOCUS_PATTERN } from "./center-weighted-autofocus-pattern";
import { getCameraForwardNdc } from "./get-camera-forward-ndc";
import { DEPTH_OF_FIELD_AUTOFOCUS_LAYER } from "./render-pipeline-scene-layers";
import { useRenderPipeline } from "./render-pipeline-provider";
import { weightedMedianFocusDistance } from "./weighted-median-focus-distance";

interface DepthOfFieldProps {
  bokeh: number;
  focalLength: number;
  focus: ResolvedDepthOfFieldFocus;
}

interface DisposableDepthOfFieldNode extends Node<"vec4"> {
  dispose(): void;
}

interface FloatUniformNode extends Node<"float"> {
  value: number;
}

interface DepthOfFieldResources {
  focusDistance: FloatUniformNode;
  focusTargetDistance: number;
  lastAutofocusTime: number;
  outputNodes: DisposableDepthOfFieldNode[];
  pointer: Vector2;
  principalPoint: Vector3;
  raycaster: Raycaster;
  direction: Vector3;
  focusPoint: Vector3;
}

export function DepthOfField({ bokeh, focalLength, focus }: DepthOfFieldProps) {
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const { registerEffect } = useRenderPipeline();
  const resourcesRef = useRef<DepthOfFieldResources | null>(null);

  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) {
      throw new TypeError("Depth of field requires a PerspectiveCamera");
    }
    const focusDistance = uniform(1) as FloatUniformNode;
    const focalLengthNode = uniform(focalLength) as FloatUniformNode;
    const outputNodes: DisposableDepthOfFieldNode[] = [];
    const raycaster = new Raycaster();
    raycaster.layers.set(DEPTH_OF_FIELD_AUTOFOCUS_LAYER);
    const resources: DepthOfFieldResources = {
      focusDistance,
      focusTargetDistance: 1,
      lastAutofocusTime: -Infinity,
      outputNodes,
      pointer: new Vector2(),
      principalPoint: new Vector3(),
      raycaster,
      direction: new Vector3(),
      focusPoint: new Vector3(),
    };
    resourcesRef.current = resources;
    const unregister = registerEffect((input, sceneDepth) => {
      const viewDepth = perspectiveDepthToViewZ(
        sceneDepth,
        uniform(camera.near),
        uniform(camera.far),
      );
      const output = dof(
        input,
        viewDepth,
        focusDistance,
        focalLengthNode,
        bokeh,
      ) as unknown as DisposableDepthOfFieldNode;
      outputNodes.push(output);
      return output;
    });
    return () => {
      resourcesRef.current = null;
      unregister();
      for (const output of outputNodes) output.dispose();
    };
  }, [bokeh, camera, focalLength, registerEffect]);

  useFrame((_state, delta) => {
    const resources = resourcesRef.current;
    if (resources === null || !(camera instanceof PerspectiveCamera)) return;
    const now = performance.now();
    if (focus.kind === "scene_point") {
      const distance = resources.focusPoint
        .fromArray(focus.position)
        .sub(camera.position)
        .dot(camera.getWorldDirection(resources.direction));
      if (distance > camera.near) resources.focusTargetDistance = distance;
    } else if (now - resources.lastAutofocusTime >= 50) {
      resources.lastAutofocusTime = now;
      scene.updateMatrixWorld(true);
      const principalPoint = getCameraForwardNdc(
        camera,
        resources.principalPoint,
      );
      const samples = CENTER_WEIGHTED_AUTOFOCUS_PATTERN.flatMap((sample) => {
        resources.pointer.set(
          principalPoint.x + sample.x,
          principalPoint.y + sample.y,
        );
        resources.raycaster.setFromCamera(resources.pointer, camera);
        const hit = resources.raycaster.intersectObjects(
          scene.children,
          true,
        )[0];
        return hit === undefined
          ? []
          : [{ distance: hit.distance, weight: sample.weight }];
      });
      const distance = weightedMedianFocusDistance(samples);
      if (distance !== null) {
        const deadZone = Math.max(distance * 0.01, 0.0001);
        if (Math.abs(distance - resources.focusTargetDistance) > deadZone) {
          resources.focusTargetDistance = distance;
        }
      }
    }
    resources.focusDistance.value = MathUtils.damp(
      resources.focusDistance.value,
      resources.focusTargetDistance,
      12,
      delta,
    );
  });

  return null;
}
