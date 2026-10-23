// Prueba el lector de Tiendanube SIN tocar la base de datos.
// Uso: npm run probar-tn -- https://divaldi.mitiendanube.com/
//      npm run probar-tn -- https://divaldi.mitiendanube.com/ https://divaldi.mitiendanube.com/productos/anillo-terra-raw/
import { tiendanubeRepository } from "../src/repositories/tiendanube.repository.js";

const tienda = process.argv[2] ?? "https://divaldi.mitiendanube.com/";
const origen = new URL(tienda).origin;
const slug = (u) => new URL(u).pathname.replace(/\/+$/, "").split("/").pop().toLowerCase();

console.log(`\nBuscando productos y categorías en ${origen} ...`);
const { esTiendanube, productos, categorias = {} } = await tiendanubeRepository.listarProductos(origen);
const nombresCategorias = [...new Set(Object.values(categorias).flat())];
console.log({
  esTiendanube,
  encontrados: productos.length,
  conCategoria: productos.filter((u) => categorias[slug(u)]?.length).length,
  categoriasDeLaTienda: nombresCategorias,
});

// por defecto prueba 3 productos distintos (o el que pases como segundo argumento)
const muestras = process.argv[3] ? [process.argv[3]] : [productos[0], productos[Math.floor(productos.length / 2)], productos.at(-1)];

for (const url of [...new Set(muestras.filter(Boolean))]) {
  console.log(`\n==================== ${url}`);
  const html = await tiendanubeRepository.obtenerPagina(url);
  const datos = tiendanubeRepository.parsearProducto(html, url);
  console.log(JSON.stringify({
    ...datos,
    descripcion: datos.descripcion ? `${datos.descripcion.slice(0, 100)}… (${datos.descripcion.length} caracteres)` : null,
    categoriasSegunListados: categorias[slug(url)] ?? [],
  }, null, 2));
}
