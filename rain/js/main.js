
//threejs scene first run
let background = document.getElementById("container");
const progress = document.getElementById("progressbar");
document.addEventListener("sceneLoaded", () => {
  if (background.style.opacity == 0) setVisible(background);
  progress.style.display = "none";
});

async function setVisible(element) {
  for (let val = 0; val < 1; val += 0.1) {
    element.style.opacity = val;
    await new Promise((r) => setTimeout(r, 75));
  }
}