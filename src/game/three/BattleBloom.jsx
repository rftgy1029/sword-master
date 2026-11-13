import { useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Vector2 } from 'three';

export default function BattleBloom() {
  const { gl, scene, camera, size, viewport } = useThree();
  const pipeline = useRef(null);
  useLayoutEffect(() => {
    const composer = new EffectComposer(gl);
    const render = new RenderPass(scene, camera);
    const bloom = new UnrealBloomPass(new Vector2(1, 1), .43, .36, 1.2);
    const output = new OutputPass();
    composer.addPass(render);
    composer.addPass(bloom);
    composer.addPass(output);
    pipeline.current = composer;
    return () => {
      pipeline.current = null;
      render.dispose();
      bloom.dispose();
      output.dispose();
      composer.dispose();
    };
  }, [gl, scene, camera]);

  useLayoutEffect(() => {
    pipeline.current?.setPixelRatio(viewport.dpr);
    pipeline.current?.setSize(size.width, size.height);
  }, [gl, scene, camera, size.width, size.height, viewport.dpr]);

  useFrame((_, delta) => pipeline.current?.render(delta), 1);
  return null;
}
