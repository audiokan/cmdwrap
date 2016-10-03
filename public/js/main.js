$(function() {
  $('[data-reload-time]').each(function(){
    var $this = $(this);

    $this.data('timer', setInterval(function(){
      var current = parseInt($this.data('current-timer'), 10) || 0,
          limit = parseInt($this.attr('data-reload-time'), 10),
          src = $this.attr('data-reload-src'),
          label = ($this.attr('data-reload-label') || '').replace(/%d/, (limit-current));

      $this.find('div').html(label);

      if (current >= limit) {
        $this.find('pre').html('Loading...');
        $.get(src, function(response){
          $this.find('pre').html(response);
        });
        $this.data('current-timer', 0);
      } else {
        $this.data('current-timer', current+1);
      }
    }, 1000));
  });
});
