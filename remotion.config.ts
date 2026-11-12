import { Config } from "@remotion/cli/config";

// WebGL (cenas 3D) no Windows precisa do renderizador ANGLE no Chrome headless
Config.setChromiumOpenGlRenderer("angle");
