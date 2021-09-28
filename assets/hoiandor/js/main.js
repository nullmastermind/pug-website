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

  $(".dropdown-btn").on("click", function (e) {
    e.stopPropagation();
  });

  $("ul.navigation li").on("click", function () {
    $(".close-btn").click();
  });

  smartMenu();
});

function smartMenu() {
  // Cache selectors
  var lastId,
    topMenu = $("#top-menu"),
    topMenuHeight = topMenu.outerHeight() + 15,
    // All list items
    menuItems = topMenu.find("a"),
    // Anchors corresponding to menu items
    scrollItems = menuItems
      .map(function () {
        try {
          var item = $($(this).attr("href"));

          if (item.length) {
            return item;
          }
        } catch (e) {}
      })
      .filter((v) => v !== undefined);

  // Bind click handler to menu items

  // Bind to scroll
  $(window).scroll(function () {
    // Get container scroll position
    var fromTop = $(this).scrollTop() + topMenuHeight;

    // Get id of current scroll item
    var cur = scrollItems.map(function () {
      if ($(this).offset().top < fromTop) return this;
    });
    // Get the id of the current element
    cur = cur[cur.length - 1];
    var id = cur && cur.length ? cur[0].id : "";

    if (lastId !== id) {
      lastId = id;
      // Set/remove active class
      // menuItems
      //   .parent()
      //   .removeClass("current")
      //   .end()
      //   .filter("[href='#" + id + "']")
      //   .parent()
      //   .addClass("current");
      $("#top-menu .current").removeClass("current");
      $(`#top-menu a[href="#${id}"]`).parent().addClass("current");
    }
  });
}
