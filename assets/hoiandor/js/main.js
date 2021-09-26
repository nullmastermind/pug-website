$(document).ready(function () {
  new Viewer(document.getElementById("images-viewer"), {
    filter(image) {
      return $(image).hasClass("allow-viewer");
    },
  });
});
