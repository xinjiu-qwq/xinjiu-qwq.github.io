(function() {
  var MusicPlayer = {
    init: function() {
      var metingEl = document.querySelector('meting-js');
      var localEl = document.getElementById('aplayer-local');
      if (metingEl) {
        // Meting mode: the <meting-js> element auto-creates APlayer
        this.waitForMetingPlayer();
      } else if (localEl && window.__LOCAL_PLAYLIST && window.__LOCAL_PLAYLIST.length) {
        // Local (self-hosted) mode: initialize APlayer from the playlist
        this.waitForAPlayerLib();
      }
    },

    waitForMetingPlayer: function() {
      var self = this;
      var checkInterval = setInterval(function() {
        var metingEl = document.querySelector('meting-js');
        if (metingEl && metingEl.aplayer) {
          clearInterval(checkInterval);
          self.onAPlayerReady(metingEl.aplayer);
        }
      }, 500);
      setTimeout(function() {
        clearInterval(checkInterval);
      }, 10000);
    },

    waitForAPlayerLib: function() {
      var self = this;
      var checkInterval = setInterval(function() {
        if (window.APlayer) {
          clearInterval(checkInterval);
          self.initLocalPlayer();
        }
      }, 200);
      setTimeout(function() {
        clearInterval(checkInterval);
      }, 10000);
    },

    initLocalPlayer: function() {
      var div = document.getElementById('aplayer-local');
      var list = window.__LOCAL_PLAYLIST;
      if (!div || !list || !list.length || !window.APlayer) return;
      var primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#0ea5e9';
      try {
        var ap = new APlayer({
          container: div,
          audio: list,
          theme: primary,
          loop: 'all',
          order: 'list',
          preload: 'none',
          autoplay: false,
          volume: 0.7,
          mutex: true,
          lrcType: 0
        });
        this.onAPlayerReady(ap);
      } catch (e) {
        console.error('[MusicPlayer] local init failed', e);
      }
    },

    onAPlayerReady: function(ap) {
      // Store reference
      window.__aplayer = ap;

      // Force playlist and lyrics to fold/close on startup
      var self = this;
      setTimeout(function() {
        if (ap.lrc) {
          ap.lrc.hide();
        }
        if (ap.list) {
          ap.list.close();
        }
      }, 200);

      // Handle volume from settings
      var savedVolume = localStorage.getItem('musicVolume');
      if (savedVolume !== null) {
        ap.volume(parseFloat(savedVolume));
      }

      ap.on('volumechange', function() {
        localStorage.setItem('musicVolume', ap.audio.volume);
      });
    }
  };

  window.MusicPlayer = MusicPlayer;
  document.addEventListener('DOMContentLoaded', function() {
    MusicPlayer.init();
  });
})();
