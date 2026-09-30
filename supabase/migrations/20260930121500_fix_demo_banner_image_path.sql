-- Keep the demo banner independent from a data URL.
update public.banners
set image_url='/banner-20-off.svg'
where id='banner_demo_20off';
