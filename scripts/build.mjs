// Lee las facturas de Notion, calcula los números y los guarda cifrados en site/data.json.
// Variables: NOTION_TOKEN, DASH_KEY (clave base64url de 32 bytes), NOTION_DATA_SOURCE_ID (opcional).
// Con MOCK=1 usa datos de prueba en vez de llamar a Notion.
import { createCipheriv, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const DS = process.env.NOTION_DATA_SOURCE_ID || "d6e19590-e5f8-49f2-a0fd-80716ebf2233";

async function leerFacturas() {
  if (process.env.MOCK) return datosPrueba();
  const filas = [];
  let cursor;
  do {
    const r = await fetch(`https://api.notion.com/v1/data_sources/${DS}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": "2025-09-03",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });
    if (!r.ok) throw new Error(`Notion ${r.status}: ${await r.text()}`);
    const j = await r.json();
    for (const p of j.results) {
      const x = p.properties;
      filas.push({
        tipo: x.Tipo?.select?.name,
        fecha: x.Fecha?.date?.start,
        base: x.Base?.number || 0,
        iva: x.IVA?.number || 0,
        suplidos: x.Suplidos?.number || 0,
        pagada: x.Pagada?.checkbox || false,
      });
    }
    cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor);
  return filas;
}

function calcular(facturas) {
  const año = new Date().getFullYear();
  const años = {}; // { 2026: { ingresos: [12], gastos: [12] }, ... }
  let porCobrar = 0, porPagar = 0, nCobrar = 0, nPagar = 0;

  for (const f of facturas) {
    const total = f.base + f.iva + f.suplidos;
    const emitida = f.tipo === "Emitida";
    if (!f.pagada) {
      if (emitida) { porCobrar += total; nCobrar++; } else { porPagar += total; nPagar++; }
    }
    if (!f.fecha) continue;
    const a = (años[f.fecha.slice(0, 4)] ??= { ingresos: Array(12).fill(0), gastos: Array(12).fill(0) });
    a[emitida ? "ingresos" : "gastos"][Number(f.fecha.slice(5, 7)) - 1] += f.base;
  }
  const suma = (x) => x.reduce((s, v) => s + v, 0);
  const actual = años[año] ?? { ingresos: [0], gastos: [0] };
  return {
    año, porCobrar, porPagar, nCobrar, nPagar, años,
    margen: suma(actual.ingresos) - suma(actual.gastos),
    actualizado: new Date().toISOString(),
  };
}

function cifrar(obj) {
  const clave = Buffer.from(process.env.DASH_KEY, "base64url");
  if (clave.length !== 32) throw new Error("DASH_KEY debe tener 32 bytes en base64url");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", clave, iv);
  const datos = Buffer.concat([c.update(JSON.stringify(obj)), c.final(), c.getAuthTag()]);
  return { iv: iv.toString("base64"), datos: datos.toString("base64") };
}

function datosPrueba() {
  const y = new Date().getFullYear();
  const f = (tipo, mes, base, pagada = true, año = y) =>
    ({ tipo, fecha: `${año}-${mes}-15`, base, iva: base * 0.1, suplidos: 0, pagada });
  return [
    f("Emitida", "04", 3000, true, y - 2), f("Recibida", "04", 1800, true, y - 2),
    f("Emitida", "05", 6200, true, y - 1), f("Recibida", "06", 3900, true, y - 1),
    f("Emitida", "10", 8100, true, y - 1), f("Recibida", "10", 4200, true, y - 1),
    f("Emitida", "03", 2400), f("Recibida", "03", 900),
    f("Emitida", "05", 5100), f("Recibida", "05", 2300),
    f("Recibida", "06", 1200),
    f("Emitida", "07", 4200), f("Recibida", "07", 1500),
    f("Emitida", "09", 6800), f("Recibida", "09", 4100),
    f("Emitida", "10", 9800, false), f("Recibida", "10", 3100, false),
    f("Emitida", "11", 3500, false), f("Recibida", "11", 2600),
  ];
}

const resultado = calcular(await leerFacturas());
writeFileSync("site/data.json", JSON.stringify(cifrar(resultado)));
console.log("Listo:", resultado.actualizado);
