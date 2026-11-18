# 함께 넣은 외부 자료 (인터넷 없이 실행하기 위함)

- `three-bundle.js`: three.js 0.149.0 과 후처리 모듈(EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, FXAAShader)을 esbuild 로 한 파일에 묶은 것. MIT License (c) three.js authors. 라이선스 원문은 파일 끝 주석에 포함.
- `fonts/`: Jua 글꼴 (Google Fonts 에서 받은 한글 부분 파일들 + `jua.css`). SIL Open Font License 1.1 (Copyright The Jua Project Authors).

다시 만들기:
```
npm install three@0.149.0 esbuild
npx esbuild entry.js --bundle --minify --format=iife --legal-comments=eof --outfile=vendor/three-bundle.js
```
(entry.js 는 three 와 위 모듈을 import 해서 window.THREE 에 넣는 짧은 파일)
