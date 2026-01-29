let confettiMod: Promise<any> | null = null;

function getConfetti() {
  if (!confettiMod) confettiMod = import("canvas-confetti").then(m => m.default ?? m);
  return confettiMod;
}

export async function celebrate() {
  const confetti = await getConfetti();
  var end = Date.now() + 1 * 1000;
  var colors = ["#f54900", "#e7000b"];
  (function frame() {
    confetti({particleCount: 2, angle: 60, spread: 55, origin: {x: 0, y: 1}, colors: colors});
    confetti({particleCount: 2, angle: 120, spread: 55, origin: {x: 1, y: 1}, colors: colors});
    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
}
