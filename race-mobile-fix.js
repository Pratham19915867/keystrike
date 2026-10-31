"use strict";

/*
 KEYSTRIKE V5
 COMPACT RACE VIEWPORT FIX
*/

(() => {

const $ = id => document.getElementById(id);

const input = $("multiplayerInput");
const passage = $("multiplayerPassage");

if (!input || !passage) return;

let frame = null;

function scrollPassageToCurrent() {
  const spans = passage.querySelectorAll("span");

  if (!spans.length) return;

  const index = Math.min(
    input.value.length,
    spans.length - 1
  );

  const current = spans[index];

  if (!current) return;

  const currentRect =
    current.getBoundingClientRect();

  const passageRect =
    passage.getBoundingClientRect();

  const relativeTop =
    currentRect.top -
    passageRect.top +
    passage.scrollTop;

  const targetTop = Math.max(
    0,
    relativeTop -
    passage.clientHeight * .35
  );

  passage.scrollTop = targetTop;
}

function keepInputVisible() {
  if (document.activeElement !== input) return;

  const viewport = window.visualViewport;

  if (!viewport) {
    input.scrollIntoView({
      block: "nearest",
      behavior: "instant"
    });
    return;
  }

  const visibleBottom =
    viewport.offsetTop + viewport.height;

  const inputRect =
    input.getBoundingClientRect();

  if (inputRect.bottom > visibleBottom - 12) {
    window.scrollBy({
      top:
        inputRect.bottom -
        visibleBottom +
        16,
      behavior: "instant"
    });
  }

  const passageRect =
    passage.getBoundingClientRect();

  if (passageRect.top < 0) {
    window.scrollBy({
      top: passageRect.top - 12,
      behavior: "instant"
    });
  }
}

function updateViewport() {
  cancelAnimationFrame(frame);

  frame = requestAnimationFrame(() => {
    scrollPassageToCurrent();
    keepInputVisible();
  });
}

input.addEventListener("focus", () => {
  document.body.classList.add(
    "ks-mp-typing"
  );

  setTimeout(updateViewport, 150);
  setTimeout(updateViewport, 400);
});

input.addEventListener("blur", () => {
  document.body.classList.remove(
    "ks-mp-typing"
  );
});

input.addEventListener(
  "input",
  updateViewport
);

window.visualViewport?.addEventListener(
  "resize",
  updateViewport
);

window.visualViewport?.addEventListener(
  "scroll",
  updateViewport
);

window.addEventListener(
  "resize",
  updateViewport
);

console.log(
  "📱 KEYSTRIKE COMPACT RACE VIEW READY"
);

})();
