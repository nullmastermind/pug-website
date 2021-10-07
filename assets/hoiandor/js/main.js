jQuery.event.special.touchstart = {
  setup: function (_, ns, handle) {
    this.addEventListener("touchstart", handle, { passive: !ns.includes("noPreventDefault") });
  },
};
jQuery.event.special.touchmove = {
  setup: function (_, ns, handle) {
    this.addEventListener("touchmove", handle, { passive: !ns.includes("noPreventDefault") });
  },
};
jQuery.event.special.wheel = {
  setup: function (_, ns, handle) {
    this.addEventListener("wheel", handle, { passive: true });
  },
};
jQuery.event.special.mousewheel = {
  setup: function (_, ns, handle) {
    this.addEventListener("mousewheel", handle, { passive: true });
  },
};

$(document).ready(function () {
  new Sticky(".la-sticky");
  $(".share-facebook").attr(
    "href",
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.href)}&t=${document.title}`
  );
  $(".share-twitter").attr(
    "href",
    `https://twitter.com/share?url=${encodeURIComponent(location.href)}&via=hoiandor&text=${document.title}`
  );

  _autoGallery();
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

  _smartMenu();
});

function _smartMenu() {
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

function _autoGallery() {
  if ($("#auto-gallery").length) {
    var $images = $(".allow-viewer:not(.la-ignore-gallery)");
    var maxImages = 9;
    var showed = {};

    // https://stackoverflow.com/a/2450976/6435579
    function shuffle(array) {
      let currentIndex = array.length,
        randomIndex;

      // While there remain elements to shuffle...
      while (currentIndex !== 0) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
      }

      return array;
    }

    shuffle($images);

    $images.each(function () {
      var src = $(this).attr("src");
      var alt = $(this).attr("alt");
      var width = $(this).attr("width");
      var height = $(this).attr("height");

      if (src && !showed[src] && Object.keys(showed).length < maxImages) {
        $("#auto-gallery").append(
          `<li><figure class="image-box"><img src="${src}" alt="${alt}" width="${width}" height="${height}" class="allow-viewer la-ignore-gallery"/></figure></li>`
        );

        showed[src] = true;
      }
    });
  }
}

$(document).ready(function () {
  document.getElementById("form-contact").addEventListener("submit", function (e) {
    e.preventDefault(); // before the code

    var $btn = $('#form-contact input[name="submit-form"]');
    var oldBtnContent = $btn.html();

    $btn.html('<i class="far fa-spin fa-spinner-third"></i>');

    fetch("https://api.dongnv.dev/api/rest/hoiandor/contacts", {
      method: "POST",
      body: JSON.stringify({
        name: $('#form-contact input[name="username"]').val(),
        mobile: $('#form-contact input[name="phone"]').val(),
        email: $('#form-contact input[name="email"]').val(),
      }),
      headers: {
        "x-hasura-admin-secret": "bigbang72",
      },
    }).finally(() => {
      alert("Cảm ơn bạn đã quan tâm sản phẩm!");
      $btn.html(oldBtnContent);
    });
  });
});
