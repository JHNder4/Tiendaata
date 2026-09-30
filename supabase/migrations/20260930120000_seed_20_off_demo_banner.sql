-- Demo banner only: this does not create or modify a real discount.
insert into public.banners (id,kind,title,subtitle,image_url,product_id,promotion_id,link,button_text,active,position)
values (
  'banner_demo_20off',
  'text',
  '20% OFF',
  'Descuento especial en productos seleccionados',
  'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%201600%20720%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23101826%22%2F%3E%3Cstop%20offset%3D%22.48%22%20stop-color%3D%22%23315b9d%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23b86f9c%22%2F%3E%3C%2FlinearGradient%3E%3Cfilter%20id%3D%22b%22%3E%3CfeGaussianBlur%20stdDeviation%3D%2245%22%2F%3E%3C%2Ffilter%3E%3C%2Fdefs%3E%3Crect%20width%3D%221600%22%20height%3D%22720%22%20fill%3D%22url(%23g)%22%2F%3E%3Cg%20filter%3D%22url(%23b)%22%20opacity%3D%22.75%22%3E%3Ccircle%20cx%3D%22260%22%20cy%3D%22120%22%20r%3D%22180%22%20fill%3D%22%238dc7ff%22%2F%3E%3Ccircle%20cx%3D%221350%22%20cy%3D%22160%22%20r%3D%22210%22%20fill%3D%22%23ffd0e7%22%2F%3E%3Ccircle%20cx%3D%221180%22%20cy%3D%22650%22%20r%3D%22240%22%20fill%3D%22%239f8cff%22%2F%3E%3C%2Fg%3E%3Cpath%20d%3D%22M0%20560C340%20400%20470%20710%20820%20510s510-90%20780%2040v170H0z%22%20fill%3D%22%23fff%22%20opacity%3D%22.12%22%2F%3E%3Ccircle%20cx%3D%22800%22%20cy%3D%22360%22%20r%3D%22250%22%20fill%3D%22none%22%20stroke%3D%22%23fff%22%20stroke-opacity%3D%22.14%22%20stroke-width%3D%222%22%2F%3E%3C%2Fsvg%3E',
  '',
  '',
  '#/catalogo',
  'Ver ofertas',
  true,
  0
)
on conflict (id) do nothing;
