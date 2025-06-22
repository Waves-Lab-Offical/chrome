const container = document.getElementById("container");
let clock = new THREE.Clock();
let isPaused = false,
  elapsedResetTime = 21600,
  elapsedPreviousTime = 0;
let devicePixelRatio = window.devicePixelRatio || 1;

let scene, camera, renderer, material;
let settings = { fps: 30, scale: 1.0, parallaxVal: 1 };
let videoElement;

// Default settings
const defaultSettings = {
  intensity: 0.4,
  speed: 0.25,
  brightness: 0.8,
  normal: 0.5,
  zoom: 2.61,
  blur_intensity: 0.5,
  blur_iterations: 16,
  panning: false,
  post_processing: true,
  lightning: false,
  texture_fill: true,
  parallax: 1,
  fps: 30
};

// Load settings from localStorage
function loadSettings() {
  try {
    const saved = localStorage.getItem('rainEffectSettings');
    if (saved) {
      return { ...defaultSettings, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Failed to load settings from localStorage:', e);
  }
  return defaultSettings;
}

// Save settings to localStorage
function saveSettings() {
  try {
    const currentSettings = {
      intensity: material.uniforms.u_intensity.value,
      speed: material.uniforms.u_speed.value,
      brightness: material.uniforms.u_brightness.value,
      normal: material.uniforms.u_normal.value,
      zoom: material.uniforms.u_zoom.value,
      blur_intensity: material.uniforms.u_blur_intensity.value,
      blur_iterations: material.uniforms.u_blur_iterations.value,
      panning: material.uniforms.u_panning.value,
      post_processing: material.uniforms.u_post_processing.value,
      lightning: material.uniforms.u_lightning.value,
      texture_fill: material.uniforms.u_texture_fill.value,
      parallax: settings.parallaxVal,
      fps: settings.fps
    };
    localStorage.setItem('rainEffectSettings', JSON.stringify(currentSettings));
  } catch (e) {
    console.warn('Failed to save settings to localStorage:', e);
  }
}

// The actual rain fragment shader
const fragmentShader = `
#ifdef GL_ES
precision highp float;
#endif

varying vec2 vUv;
uniform sampler2D u_tex0;
uniform vec2 u_tex0_resolution;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_speed;
uniform float u_intensity;
uniform float u_normal;
uniform float u_brightness;
uniform float u_blur_intensity;
uniform float u_zoom;
uniform int u_blur_iterations;
uniform bool u_panning;
uniform bool u_post_processing;
uniform bool u_lightning;
uniform bool u_texture_fill;

#define S(a, b, t) smoothstep(a, b, t)

vec3 N13(float p) {
    //  from DAVE HOSKINS
    vec3 p3 = fract(vec3(p) * vec3(.1031, .11369, .13787));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

vec4 N14(float t) {
    return fract(sin(t * vec4(123., 1024., 1456., 264.)) * vec4(6547., 345., 8799., 1564.));
}
float N(float t) {
    return fract(sin(t * 12345.564) * 7658.76);
}

float Saw(float b, float t) {
    return S(0., b, t) * S(1., b, t);
}

vec2 DropLayer2(vec2 uv, float t) {
    vec2 UV = uv;

    uv.y += t * 0.75;
    vec2 a = vec2(6., 1.);
    vec2 grid = a * 2.;
    vec2 id = floor(uv * grid);

    float colShift = N(id.x);
    uv.y += colShift;

    id = floor(uv * grid);
    vec3 n = N13(id.x * 35.2 + id.y * 2376.1);
    vec2 st = fract(uv * grid) - vec2(.5, 0);

    float x = n.x - .5;

    float y = UV.y * 20.;
    float wiggle = sin(y + sin(y));
    x += wiggle * (.5 - abs(x)) * (n.z - .5);
    x *= .7;
    float ti = fract(t + n.z);
    y = (Saw(.85, ti) - .5) * .9 + .5;
    vec2 p = vec2(x, y);

    float d = length((st - p) * a.yx);

    float mainDrop = S(.4, .0, d);

    float r = sqrt(S(1., y, st.y));
    float cd = abs(st.x - x);
    float trail = S(.23 * r, .15 * r * r, cd);
    float trailFront = S(-.02, .02, st.y - y);
    trail *= trailFront * r * r;

    y = UV.y;
    float trail2 = S(.2 * r, .0, cd);
    float droplets = max(0., (sin(y * (1. - y) * 120.) - st.y)) * trail2 * trailFront * n.z;
    y = fract(y * 10.) + (st.y - .5);
    float dd = length(st - vec2(x, y));
    droplets = S(.3, 0., dd);
    float m = mainDrop + droplets * r * trailFront;

    return vec2(m, trail);
}

float StaticDrops(vec2 uv, float t) {
    uv *= 40.;

    vec2 id = floor(uv);
    uv = fract(uv) - .5;
    vec3 n = N13(id.x * 107.45 + id.y * 3543.654);
    vec2 p = (n.xy - .5) * .7;
    float d = length(uv - p);

    float fade = Saw(.025, fract(t + n.z));
    float c = S(.3, 0., d) * fract(n.z * 10.) * fade;
    return c;
}

vec2 Drops(vec2 uv, float t, float l0, float l1, float l2) {
    float s = StaticDrops(uv, t) * l0;
    vec2 m1 = DropLayer2(uv, t) * l1;
    vec2 m2 = DropLayer2(uv * 1.85, t) * l2;

    float c = s + m1.x + m2.x;
    c = S(.3, 1., c);

    return vec2(c, max(m1.y * l0, m2.y * l1));
}

//random no.
float N21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - .5 * u_resolution.xy) / u_resolution.y;
    vec2 UV = gl_FragCoord.xy / u_resolution.xy;
    float T = u_time;

    if(u_texture_fill) {
        float screenAspect = u_resolution.x / u_resolution.y;
        float textureAspect = u_tex0_resolution.x / u_tex0_resolution.y;
        float scaleX = 1., scaleY = 1.;
        if(textureAspect > screenAspect )
            scaleX = screenAspect / textureAspect;
        else
            scaleY = textureAspect / screenAspect;
        UV = vec2(scaleX, scaleY) * (UV - 0.5) + 0.5;
    }

    float t = T * .2 * u_speed;

    float rainAmount = u_intensity;

    float zoom = u_panning ? -cos(T * .2) : 0.;
    uv *= (.7 + zoom * .3) * u_zoom;

    float staticDrops = S(-.5, 1., rainAmount) * 2.;
    float layer1 = S(.25, .75, rainAmount);
    float layer2 = S(.0, .5, rainAmount);

    vec2 c = Drops(uv, t, staticDrops, layer1, layer2);
    
    vec2 e = vec2(.001, 0.) * u_normal;
    float cx = Drops(uv + e, t, staticDrops, layer1, layer2).x;
    float cy = Drops(uv + e.yx, t, staticDrops, layer1, layer2).x;
    vec2 n = vec2(cx - c.x, cy - c.x);

    vec3 col = texture2D(u_tex0, UV + n).rgb;
    vec4 texCoord = vec4(UV.x + n.x, UV.y + n.y, 0, 1.0 * 25. * 0.01 / 7.);

    if(u_blur_iterations != 1) {
        float blur = u_blur_intensity;
        blur *= 0.01;
        float a = N21(gl_FragCoord.xy) * 6.2831;
        for(int m = 0; m < 64; m++) {
            if(m > u_blur_iterations)
                break;
            vec2 offs = vec2(sin(a), cos(a)) * blur;
            float d = fract(sin((float(m) + 1.) * 546.) * 5424.);
            d = sqrt(d);
            offs *= d;
            col += texture2D(u_tex0, texCoord.xy + vec2(offs.x, offs.y)).xyz;
            a++;
        }
        col /= float(u_blur_iterations);
    }

    t = (T + 3.) * .5;
    if(u_post_processing) {
        col *= mix(vec3(1.), vec3(.8, .9, 1.3), 1.);
    }
    float fade = S(0., 10., T);

    if(u_lightning) {
        float lightning = sin(t * sin(t * 10.));
        lightning *= pow(max(0., sin(t + sin(t))), 10.);
        col *= 1. + lightning * fade * mix(1., .1, 0.);
    }
    col *= 1. - dot(UV -= .5, UV) * 1.;

    gl_FragColor = vec4(col * u_brightness, 1);
}
`;

//custom events
const sceneLoadedEvent = new Event("sceneLoaded");

async function init() {
  // Load saved settings
  const savedSettings = loadSettings();
  
  renderer = new THREE.WebGLRenderer({
    antialias: false,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(settings.scale * devicePixelRatio);
  container.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  material = new THREE.ShaderMaterial({
    uniforms: {
      u_tex0: { type: "t" },
      u_time: { value: 0, type: "f" },
      u_intensity: { value: savedSettings.intensity, type: "f" },
      u_speed: { value: savedSettings.speed, type: "f" },
      u_brightness: { value: savedSettings.brightness, type: "f" },
      u_normal: { value: savedSettings.normal, type: "f" },
      u_zoom: { value: savedSettings.zoom, type: "f" },
      u_blur_intensity: { value: savedSettings.blur_intensity, type: "f" },
      u_blur_iterations: { value: savedSettings.blur_iterations, type: "i" },
      u_panning: { value: savedSettings.panning, type: "b" },
      u_post_processing: { value: savedSettings.post_processing, type: "b" },
      u_lightning: { value: savedSettings.lightning, type: "b" },
      u_texture_fill: { value: savedSettings.texture_fill, type: "b" },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight), type: "v2" },
      u_tex0_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight), type: "v2" },
    },
    vertexShader: `
          varying vec2 vUv;        
          void main() {
              vUv = uv;
              gl_Position = vec4( position, 1.0 );    
          }
        `,
    fragmentShader: fragmentShader
  });

  // Apply saved settings
  settings.parallaxVal = savedSettings.parallax;
  settings.fps = savedSettings.fps;

  resize();

  // Create a default texture (solid color) if no image is loaded
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d');
  context.fillStyle = '#1a1a2e';
  context.fillRect(0, 0, 1, 1);
  const defaultTexture = new THREE.CanvasTexture(canvas);
  
  material.uniforms.u_tex0_resolution.value = new THREE.Vector2(1920, 1080);
  material.uniforms.u_tex0.value = defaultTexture;

  // Try to load default image, fallback to canvas texture if it fails
  try {
    const loader = new THREE.TextureLoader();
    const texture = await loader.loadAsync("media/image.webp");
    material.uniforms.u_tex0.value = texture;
    material.uniforms.u_tex0_resolution.value = new THREE.Vector2(texture.image.width, texture.image.height);
  } catch (error) {
    console.log("Default image not found, using solid color background");
  }

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 1, 1), material);
  scene.add(quad);

  window.addEventListener("resize", (e) => resize());
  render();
  createSimpleControls();

  document.dispatchEvent(sceneLoadedEvent);
}

function setScale(userScale) {
  settings.scale = userScale;
  const finalScale = devicePixelRatio * settings.scale;
  if (renderer.getPixelRatio() == finalScale)
    return;

  renderer.setPixelRatio(finalScale);
  material.uniforms.u_resolution.value = new THREE.Vector2(
    window.innerWidth * finalScale,
    window.innerHeight * finalScale
  );
}

function resize() {
  if (window.devicePixelRatio !== devicePixelRatio) {
    devicePixelRatio = window.devicePixelRatio || 1;
    setScale(settings.scale);
  }
  const finalScale = devicePixelRatio * settings.scale;

  renderer.setSize(window.innerWidth, window.innerHeight);
  material.uniforms.u_resolution.value = new THREE.Vector2(
    window.innerWidth * finalScale,
    window.innerHeight * finalScale
  );
}

function render() {
  setTimeout(function () {
    requestAnimationFrame(render);
  }, 1000 / settings.fps);

  //reset every 6hr
  if (clock.getElapsedTime() > elapsedResetTime) clock = new THREE.Clock();
  material.uniforms.u_time.value = clock.getElapsedTime();

  renderer.render(scene, camera);
}

// Simple controls replacement for dat.GUI
function createSimpleControls() {
  // Create controls container
  const controlsContainer = document.createElement('div');
  controlsContainer.id = 'controls';
  controlsContainer.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 15px;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    z-index: 1000;
    display: none;
    max-width: 250px;
    max-height: 80vh;
    overflow-y: auto;
  `;

  // Create toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = '';
  toggleBtn.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    border: none;
    padding: 10px;
    border-radius: 5px;
    cursor: pointer;
    z-index: 1001;
    font-size: 14px;
  `;

  let controlsVisible = false;
  toggleBtn.onclick = () => {
    controlsVisible = !controlsVisible;
    controlsContainer.style.display = controlsVisible ? 'block' : 'none';
  };

  // Helper function to create controls
  function addControl(label, type, value, min, max, step, callback) {
    const div = document.createElement('div');
    div.style.marginBottom = '10px';
    
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.display = 'block';
    labelEl.style.marginBottom = '5px';
    
    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    if (step !== undefined) input.step = step;
    if (type === 'checkbox') input.checked = value;
    
    input.style.width = '100%';
    input.addEventListener('input', (e) => {
      const val = type === 'checkbox' ? e.target.checked : parseFloat(e.target.value);
      callback(val);
      saveSettings(); // Save settings whenever they change
    });
    
    div.appendChild(labelEl);
    div.appendChild(input);
    controlsContainer.appendChild(div);
  }

  // Add file input for background
  const fileDiv = document.createElement('div');
  fileDiv.style.marginBottom = '10px';
  const fileLabel = document.createElement('label');
  fileLabel.textContent = 'Background Image/Video';
  fileLabel.style.display = 'block';
  fileLabel.style.marginBottom = '5px';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,video/*';
  fileInput.style.width = '100%';
  fileInput.addEventListener('change', handleFileSelect);
  fileDiv.appendChild(fileLabel);
  fileDiv.appendChild(fileInput);
  controlsContainer.appendChild(fileDiv);

  // Add controls with saved values
  addControl('Rain Intensity', 'range', material.uniforms.u_intensity.value, 0, 1, 0.01, 
    (val) => material.uniforms.u_intensity.value = val);
  
  addControl('Rain Speed', 'range', material.uniforms.u_speed.value, 0, 2, 0.01, 
    (val) => material.uniforms.u_speed.value = val);
  
  addControl('Brightness', 'range', material.uniforms.u_brightness.value, 0, 2, 0.01, 
    (val) => material.uniforms.u_brightness.value = val);
  
  addControl('Normal', 'range', material.uniforms.u_normal.value, 0, 3, 0.01, 
    (val) => material.uniforms.u_normal.value = val);
  
  addControl('Zoom', 'range', material.uniforms.u_zoom.value, 0.1, 5, 0.01, 
    (val) => material.uniforms.u_zoom.value = val);
  
  addControl('Blur Intensity', 'range', material.uniforms.u_blur_intensity.value, 0, 2, 0.01, 
    (val) => material.uniforms.u_blur_intensity.value = val);
  
  addControl('Blur Quality', 'range', material.uniforms.u_blur_iterations.value, 1, 64, 1, 
    (val) => material.uniforms.u_blur_iterations.value = parseInt(val));
  
  addControl('Parallax', 'range', settings.parallaxVal, 0, 3, 0.1, 
    (val) => settings.parallaxVal = val);
  
  addControl('FPS', 'range', settings.fps, 15, 120, 15, 
    (val) => settings.fps = val);
  
  addControl('Lightning', 'checkbox', material.uniforms.u_lightning.value, null, null, null, 
    (val) => material.uniforms.u_lightning.value = val);
  
  addControl('Panning', 'checkbox', material.uniforms.u_panning.value, null, null, null, 
    (val) => material.uniforms.u_panning.value = val);
  
  addControl('Post Processing', 'checkbox', material.uniforms.u_post_processing.value, null, null, null, 
    (val) => material.uniforms.u_post_processing.value = val);
  
  addControl('Scale to Fill', 'checkbox', material.uniforms.u_texture_fill.value, null, null, null, 
    (val) => material.uniforms.u_texture_fill.value = val);

  // Add reset button
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset to Defaults';
  resetBtn.style.cssText = `
    width: 100%;
    padding: 8px;
    background: #444;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 10px;
  `;
  resetBtn.onclick = () => {
    // Reset all values to defaults
    material.uniforms.u_intensity.value = defaultSettings.intensity;
    material.uniforms.u_speed.value = defaultSettings.speed;
    material.uniforms.u_brightness.value = defaultSettings.brightness;
    material.uniforms.u_normal.value = defaultSettings.normal;
    material.uniforms.u_zoom.value = defaultSettings.zoom;
    material.uniforms.u_blur_intensity.value = defaultSettings.blur_intensity;
    material.uniforms.u_blur_iterations.value = defaultSettings.blur_iterations;
    material.uniforms.u_panning.value = defaultSettings.panning;
    material.uniforms.u_post_processing.value = defaultSettings.post_processing;
    material.uniforms.u_lightning.value = defaultSettings.lightning;
    material.uniforms.u_texture_fill.value = defaultSettings.texture_fill;
    settings.parallaxVal = defaultSettings.parallax;
    settings.fps = defaultSettings.fps;
    
    // Update control inputs
    const inputs = controlsContainer.querySelectorAll('input');
    inputs.forEach(input => {
      const label = input.previousElementSibling.textContent;
      switch(label) {
        case 'Rain Intensity': input.value = defaultSettings.intensity; break;
        case 'Rain Speed': input.value = defaultSettings.speed; break;
        case 'Brightness': input.value = defaultSettings.brightness; break;
        case 'Normal': input.value = defaultSettings.normal; break;
        case 'Zoom': input.value = defaultSettings.zoom; break;
        case 'Blur Intensity': input.value = defaultSettings.blur_intensity; break;
        case 'Blur Quality': input.value = defaultSettings.blur_iterations; break;
        case 'Parallax': input.value = defaultSettings.parallax; break;
        case 'FPS': input.value = defaultSettings.fps; break;
        case 'Lightning': input.checked = defaultSettings.lightning; break;
        case 'Panning': input.checked = defaultSettings.panning; break;
        case 'Post Processing': input.checked = defaultSettings.post_processing; break;
        case 'Scale to Fill': input.checked = defaultSettings.texture_fill; break;
      }
    });
    
    saveSettings();
  };
  controlsContainer.appendChild(resetBtn);

  document.body.appendChild(toggleBtn);
  document.body.appendChild(controlsContainer);
}

// Handle file selection
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  disposeVideoElement(videoElement);
  if (material.uniforms.u_tex0.value) {
    material.uniforms.u_tex0.value.dispose();
  }

  if (file.type.startsWith('image/')) {
    const loader = new THREE.TextureLoader();
    loader.load(URL.createObjectURL(file), function (tex) {
      material.uniforms.u_tex0.value = tex;
      material.uniforms.u_tex0_resolution.value = new THREE.Vector2(tex.image.width, tex.image.height);
    });
  } else if (file.type.startsWith('video/')) {
    videoElement = createVideoElement(URL.createObjectURL(file));
    const videoTexture = new THREE.VideoTexture(videoElement);
    videoElement.addEventListener('loadedmetadata', function () {
      material.uniforms.u_tex0_resolution.value = new THREE.Vector2(
        videoTexture.image.videoWidth,
        videoTexture.image.videoHeight
      );
    });
    material.uniforms.u_tex0.value = videoTexture;
  }
}

//parallax
document.addEventListener("mousemove", function (event) {
  if (settings.parallaxVal == 0) return;

  const x = (window.innerWidth - event.pageX * settings.parallaxVal) / 90;
  const y = (window.innerHeight - event.pageY * settings.parallaxVal) / 90;

  container.style.transform = `translateX(${x}px) translateY(${y}px) scale(1.09)`;
});

//helpers
function getExtension(filePath) {
  return filePath.substring(filePath.lastIndexOf(".") + 1, filePath.length).toLowerCase() || filePath;
}

function createVideoElement(src) {
  let htmlVideo = document.createElement("video");
  htmlVideo.src = src;
  htmlVideo.muted = true;
  htmlVideo.loop = true;
  htmlVideo.play();
  return htmlVideo;
}

function disposeVideoElement(video) {
  if (video != null && video.hasAttribute("src")) {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}