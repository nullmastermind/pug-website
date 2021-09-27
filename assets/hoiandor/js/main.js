$(document).ready(function () {
  new Viewer(document.getElementById("images-viewer"), {
    filter(image) {
      return $(image).hasClass("allow-viewer");
    },
    url(image) {
      return image.src.replace("-cropped.", ".");
    },
  });

  var sameHeightClasses = [".la-same-height-02", ".la-same-height-03"];

  for (var i = 0; i < sameHeightClasses.length; i++) {
    var maxHeight = -1;

    $(sameHeightClasses[i]).each(function (index) {
      var offset = parseInt($(this).attr("data-offset") || "0");
      var height = $(this).height() + offset;

      if (height > maxHeight) maxHeight = height;
    });

    if (maxHeight > 0) {
      $(sameHeightClasses[i]).css("height", maxHeight + "px");
    }
  }
});
