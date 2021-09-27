$(document).ready(function () {
  new Viewer(document.getElementById("images-viewer"), {
    filter(image) {
      return $(image).hasClass("allow-viewer");
    },
    url(image) {
      return image.src.replace("-cropped.", ".");
    },
  });

  // var sameHeightClasses = [".la-same-height-01"];
  //
  // for (var i = 0; i < sameHeightClasses.length; i++) {
  //   var maxHeight = -1;
  //
  //   $(sameHeightClasses[i]).each(function (index) {
  //     var height = $(this).height();
  //
  //     if (height > maxHeight) maxHeight = height;
  //   });
  //
  //   if (maxHeight > 0) {
  //     $(sameHeightClasses[i]).css("height", maxHeight + 22 + "px");
  //   }
  // }
});
