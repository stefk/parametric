(() => {
  const inputX = document.querySelector("[name=x-fn]");
  const inputY = document.querySelector("[name=y-fn]");
  const submit = document.querySelector("[type=submit]");
  const example = document.querySelector("[type=button]");
  const canvas1 = document.querySelector("#cartesian");
  const canvas2 = document.querySelector("#polar");
  const cartesianGl = canvas1.getContext("webgl");
  const polarGl = canvas2.getContext("webgl");

  if (!cartesianGl || !polarGl) {
    return alert(
      "Sorry, your system doesn't seem to support WebGL"
    );
  }

  const unitsPerAxe = 8;
  const renderCartesian = initGl(cartesianGl, unitsPerAxe);
  const renderPolar = initGl(polarGl, unitsPerAxe);

  setAndDraw("t", "t/2");

  submit.addEventListener("click", event => {
    event.preventDefault();
    draw(inputX.value, inputY.value);
  });

  const examples = [
    ["cos(t)", "sin(t)"],
    ["2 * cos(t)^3", "2 * sin(t)^3"],
    ["log(t) - sin(t)", "sin(t)"],
    ["t * 100", "t"],
    ["t", "1 + sin(t * 4)"],
    ["t", "2 + abs(sin(t * 7)) / 3"],
    ["t / 2", "tan(t)"],
    ["sin(t * 4) * t/4", "t"],
    ["t^2", "abs(t)"],
    ["100 * cos(t)", "abs(t) / 5"],
    ["cos(t)^3", "3 * sin(t)^3 + log(t)"],
    ["tan(t)^3", "5 * sin(t) + log(t)"],
  ];

  (() => {
    let exampleIndex = 1;

    example.addEventListener("click", () => {
      const [exX, exY] = examples[exampleIndex];
      setAndDraw(exX, exY)
      exampleIndex = exampleIndex < examples.length - 1
        ? exampleIndex + 1
        : 0;
    });
  })();

  function setAndDraw(exprX, exprY) {
    inputX.value = exprX;
    inputY.value = exprY;
    draw(exprX, exprY);
  }

  function draw(exprX, exprY) {
    const compiledX = window.math.compile(exprX);
    const compiledY = window.math.compile(exprY);
    drawCartesian(
      compiledX,
      compiledY,
      unitsPerAxe,
      renderCartesian
    );
    drawPolar(
      compiledX,
      compiledY,
      unitsPerAxe,
      renderPolar
    );
  }
})();

function initGl(gl, unitsPerAxe) {
  setupResize(gl);

  const vertexShaderSource = `
    attribute vec2 a_position;
    uniform float u_scale;

    void main() {
      gl_Position = vec4(a_position.xy / u_scale, 0, 1);
    }
  `;
  const fragmentShaderSource = `
    precision mediump float;

    uniform vec4 u_color;

    void main() {
      gl_FragColor = u_color;
    }
  `;
  const vertexShader = createShader(
    gl,
    gl.VERTEX_SHADER,
    vertexShaderSource
  );
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );
  const program = createProgram(
    gl,
    vertexShader,
    fragmentShader
  );
  const positionAttributeLocation = gl.getAttribLocation(
    program,
    "a_position"
  );
  const scaleUniformLocation = gl.getUniformLocation(
    program,
    "u_scale"
  );
  const colorUniformLocation = gl.getUniformLocation(
    program,
    "u_color"
  );
  const positionBuffer = gl.createBuffer();

  // the following calls are usually done at render time
  // but since we're just doing simple fixed 2D, we can
  // afford to make them only once at setup
  gl.useProgram(program);
  gl.uniform1f(scaleUniformLocation, unitsPerAxe / 2);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.vertexAttribPointer(
    positionAttributeLocation,
    2,        // components per iteration
    gl.FLOAT, // data type
    false,    // no data normalization
    0,        // stride
    0,        // offset
  );

  return makeRender(gl, colorUniformLocation);
}

function setupResize(gl) {
  function resize() {
    gl.canvas.style.height = gl.canvas.clientWidth;
    gl.canvas.width = gl.canvas.clientWidth;
    gl.canvas.height = gl.canvas.clientHeight;
  }

  resize();
  window.addEventListener("resize", resize);
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  const success = gl.getShaderParameter(
    shader,
    gl.COMPILE_STATUS
  );

  if (!success) {
    const log = gl.getShaderInfoLog(shader);
    const kind = type === gl.VERTEX_SHADER
      ? "vertex"
      : "fragment";

    gl.deleteShader(shader);

    throw new Error(`Error in ${kind} shader: ${log}`);
  }

  return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  const success = gl.getProgramParameter(
    program,
    gl.LINK_STATUS
  );

  if (!success) {
    const log = gl.getProgramInfoLog(program);

    gl.deleteProgram(program);

    throw new Error(`Error while linking program: ${log}`);
  }

  return program;
}

function makeRender(gl, colorUniformLocation) {
  return (objects)  => {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    objects.forEach(({ components, primitive, color }) => {
      gl.uniform4f(colorUniformLocation, ...color);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(components),
        gl.STATIC_DRAW
      );
      gl.drawArrays(
        primitive,
        0,
        components.length / 2
      );
    });
  };
}

function getBasis(unitsPerAxe) {
  const semiAxisUnits = unitsPerAxe / 2;
  const axes = {
    primitive: WebGLRenderingContext.LINES,
    color: [0, 0, 0.5, 1],
    components: [
      -semiAxisUnits, 0,
      semiAxisUnits, 0,
      0, semiAxisUnits,
      0, -semiAxisUnits
    ]
  };

  for (let i = -semiAxisUnits; i < semiAxisUnits; ++i) {
    axes.components.push(i, 0.06, i, -0.06); // x mark
    axes.components.push(-0.06, i, 0.06, i); // y mark
  }

  return axes;
}

function drawCartesian(exprX, exprY, unitsPerAxe, render) {
  const components = [];

  for (let t = -1000; t < 1000; t += 0.05) {
    const x = exprX.eval({ t });
    const y = exprY.eval({ t });
    components.push(x, y);
  }

  draw(components, unitsPerAxe, render);
}

function drawPolar(exprX, exprY, unitsPerAxe, render) {
  const components = [];

  for (let t = -1000; t < 1000; t += 0.01) {
    const angle = exprX.eval({ t });
    const radius = exprY.eval({ t });

    if (radius < 0) {
      continue;
    }

    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);

    components.push(x, y);
  }

  draw(components, unitsPerAxe, render);
}

function draw(components, unitsPerAxe, renderFunc) {
  return renderFunc([
    getBasis(unitsPerAxe),
    {
      primitive: WebGLRenderingContext.LINE_STRIP,
      color: [0.3, 1, 0.3, 1],
      components
    }
  ]);
}

