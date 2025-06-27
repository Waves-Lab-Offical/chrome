/**
 *@comment Let me update the day every 24 hours…
  because some dude out there is gonna run a 48-hour timelapse with rain shaders and lo-fi beats.
 */

async function update() {
  return new Promise((reject, resolve) => {
    setTimeout(() => {
      const day = document.querySelector("#day");
      const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
      const today = new Date();
      const realday = days[today.getDay()];
      day.innerHTML = realday;
      resolve(0)
    }, 2000)
  })
}

setInterval(async () => {
  await update()
}, 1000 * 60 * 60 * 24)

async function init() {
  await update()
}

document.querySelector(".search").addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const val = document.querySelector(".search").value.trim();

    const hasProtocol = /^(https?|file|ftp):\/\//i.test(val);
    const isDomain = /^[\w-]+\.[a-z]{2,}$/i.test(val); // e.g., example.com

    let finalURL = "";

    if (hasProtocol) {
      finalURL = val;
    } else if (isDomain) {
      finalURL = `https://${val}`;
    } else {
      // fallback to Google Search
      const encodedQuery = encodeURIComponent(val);
      finalURL = `https://www.google.com/search?q=${encodedQuery}`;
    }

    window.open(finalURL, "_blank");
  }
});

function getFormattedTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();

  const ampm = hours >= 12 ? 'PM' : 'AM';

  // Convert to 12-hour format
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12

  const paddedMinutes = String(minutes).padStart(2, '0');

  return `${hours}:${paddedMinutes} ${ampm}`;
}

document.addEventListener('DOMContentLoaded', async (e) => {
  await init()
})