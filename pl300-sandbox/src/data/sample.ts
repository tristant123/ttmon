// Deterministic "Contoso" sample files in every format the sandbox can import,
// with deliberate data-quality problems to practise on.
import * as XLSX from 'xlsx';
import { MTable, DataType } from '../core/values';
import type { StoredFile } from '../m/sources';
import { ROOT_FOLDER } from '../m/sources';

function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const us = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

export const PRODUCTS: [number, string, string, string, string, number, number][] = [];
const cats: Record<string, [string, string[], [number, number]][]> = {
  Bikes: [['Mountain Bikes', ['Black', 'Silver', 'Red'], [540, 3400]], ['Road Bikes', ['Red', 'Yellow', 'Black'], [400, 3600]], ['Touring Bikes', ['Blue', 'Yellow'], [740, 2400]]],
  Accessories: [['Helmets', ['Red', 'Blue', 'Black'], [35, 35]], ['Bottles and Cages', ['Silver', 'NA'], [5, 10]], ['Locks', ['NA'], [25, 25]], ['Lights', ['NA'], [14, 40]]],
  Clothing: [['Jerseys', ['Multi', 'Yellow'], [50, 55]], ['Gloves', ['Black'], [24, 50]], ['Caps', ['Multi'], [9, 9]], ['Socks', ['White'], [9, 9]]],
  Components: [['Wheels', ['Black', 'Silver'], [100, 300]], ['Brakes', ['Silver'], [64, 107]], ['Chains', ['Silver'], [20, 20]]],
};
{
  let id = 1; const r = rng(7);
  for (const [cat, subs] of Object.entries(cats)) for (const [sub, colors, [lo, hi]] of subs) {
    const n = cat === 'Bikes' ? 6 : 3;
    for (let k = 0; k < n; k++) {
      const color = colors[k % colors.length];
      const price = Math.round((lo + r() * (hi - lo)) * 100) / 100;
      const nm = `${sub.replace(/s$/, '').replace(/ and Cage$/, ' Cage')} ${['100', '200', '300', '400', '500', '600'][k]}${color !== 'NA' ? ' - ' + color : ''}`;
      PRODUCTS.push([id++, nm, cat, sub, color, Math.round(price * 0.6 * 100) / 100, price]);
    }
  }
}
const FIRST = ['Ana', 'Ben', 'Chloe', 'Diego', 'Emma', 'Farah', 'Gabe', 'Hana', 'Ivan', 'Jia', 'Kofi', 'Lena', 'Mateo', 'Nora', 'Omar', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tara', 'Uma', 'Victor', 'Wen', 'Xavier', 'Yara', 'Zane'];
const LAST = ['Smith', 'Garcia', 'Chen', 'Okafor', 'Müller', 'Rossi', 'Kim', 'Patel', 'Silva', 'Novak', 'Dubois', 'Johnson', 'Tanaka', 'Haddad', 'Larsen'];
const GEO: [string, string, string, string][] = [
  ['Seattle', 'Washington', 'United States', 'North America'], ['Portland', 'Oregon', 'United States', 'North America'], ['Austin', 'Texas', 'United States', 'North America'],
  ['New York', 'New York', 'United States', 'North America'], ['Toronto', 'Ontario', 'Canada', 'North America'], ['Vancouver', 'British Columbia', 'Canada', 'North America'],
  ['London', 'England', 'United Kingdom', 'Europe'], ['Paris', 'Île-de-France', 'France', 'Europe'], ['Berlin', 'Berlin', 'Germany', 'Europe'], ['Madrid', 'Madrid', 'Spain', 'Europe'],
  ['Sydney', 'New South Wales', 'Australia', 'Pacific'], ['Melbourne', 'Victoria', 'Australia', 'Pacific'],
];
export const CUSTOMERS: { id: number; first: string; last: string; email: string; city: string; state: string; country: string; birth: Date; segment: string; region: string }[] = [];
{
  const r = rng(11);
  for (let i = 1; i <= 240; i++) {
    const f = FIRST[Math.floor(r() * FIRST.length)], l = LAST[Math.floor(r() * LAST.length)];
    const g = GEO[Math.floor(r() * GEO.length)];
    CUSTOMERS.push({ id: 10000 + i, first: f, last: l, email: `${f}.${l}${i}@example.com`.toLowerCase().replace('ü', 'u'), city: g[0], state: g[1], country: g[2], region: g[3],
      birth: new Date(1955 + Math.floor(r() * 45), Math.floor(r() * 12), 1 + Math.floor(r() * 28)), segment: ['Consumer', 'Corporate', 'Small Business'][Math.floor(r() * 3)] });
  }
}
export const STORES: [number, string, string, string, string, string][] = [
  [1, 'Contoso Seattle', 'North America', 'Seattle', 'Alex Rivera', 'alex@contoso.com'],
  [2, 'Contoso Toronto', 'North America', 'Toronto', 'Alex Rivera', 'alex@contoso.com'],
  [3, 'Contoso London', 'Europe', 'London', 'Brooke Lee', 'brooke@contoso.com'],
  [4, 'Contoso Berlin', 'Europe', 'Berlin', 'Brooke Lee', 'brooke@contoso.com'],
  [5, 'Contoso Sydney', 'Pacific', 'Sydney', 'Chris Ng', 'chris@contoso.com'],
  [6, 'Contoso Online', 'Online', 'Seattle', 'Dana Ortiz', 'dana@contoso.com'],
];
export interface SaleRow { order: number; line: number; date: Date; ship: Date; cust: number; prod: number; store: number; qty: number; price: number; disc: number }
export const SALES: SaleRow[] = [];
{
  const r = rng(42);
  let order = 50000;
  const start = new Date(2023, 0, 1).getTime();
  for (let i = 0; i < 2600; i++) {
    const day = Math.floor(Math.pow(r(), 0.85) * 1095);
    const date = new Date(start + day * 86400000);
    const d0 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const ship = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 2 + Math.floor(r() * 6));
    const p = PRODUCTS[Math.floor(Math.pow(r(), 1.3) * PRODUCTS.length)];
    const season = 1 + 0.3 * Math.sin(((d0.getMonth() + 3) / 12) * 2 * Math.PI);
    const qty = p[2] === 'Bikes' ? 1 + Math.floor(r() * 2 * season) : 1 + Math.floor(r() * 4 * season);
    const lines = r() < 0.2 ? 2 : 1;
    order++;
    for (let ln = 1; ln <= lines; ln++) {
      const pp = ln === 1 ? p : PRODUCTS[Math.floor(r() * PRODUCTS.length)];
      SALES.push({ order, line: ln, date: d0, ship, cust: CUSTOMERS[Math.floor(r() * CUSTOMERS.length)].id, prod: pp[0], store: 1 + Math.floor(r() * 6), qty: ln === 1 ? qty : 1, price: pp[6], disc: r() < 0.15 ? 0.1 : 0 });
    }
  }
}

function csv(rows: any[][]) {
  return rows.map(r => r.map(v => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n') + '\r\n';
}
const enc = (s: string) => new TextEncoder().encode(s);

export function salesCsv(): Uint8Array {
  const rows: any[][] = [['SalesOrderNumber', 'SalesOrderLineNumber', 'OrderDate', 'ShipDate', 'CustomerKey', 'ProductKey', 'StoreKey', 'OrderQuantity', 'UnitPrice', 'DiscountPct']];
  SALES.forEach((s, i) => {
    let price: any = s.price.toFixed(2);
    let qty: any = s.qty;
    if (i % 397 === 13) price = 'N/A';      // causes errors after Changed Type
    if (i % 523 === 7) qty = '';            // null quantity
    rows.push([`SO${s.order}`, s.line, iso(s.date), iso(s.ship), s.cust, s.prod, s.store, qty, price, s.disc]);
  });
  rows.push(rows[25]); rows.push(rows[26]); // duplicate rows to remove
  return enc(csv(rows));
}

export function productsXlsx(): Uint8Array {
  const wb = XLSX.utils.book_new();
  const r = rng(5);
  const aoa: any[][] = [['Contoso Product List'], ['Exported 2025-01-02 from the ERP system'], [], ['ProductKey', 'Product Name', 'Category', 'Subcategory', 'Color', 'Standard Cost', 'List Price']];
  for (const p of PRODUCTS) {
    const messy = r() < 0.15 ? `  ${p[1]}  ` : r() < 0.1 ? p[1].toUpperCase() : p[1];
    aoa.push([p[0], messy, p[2], p[3], p[4], p[5], p[6]]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Products');
  const cat = [['Category', 'Category Manager', 'Margin Target'], ['Bikes', 'Ines Park', 0.35], ['Accessories', 'Tom Hale', 0.55], ['Clothing', 'Tom Hale', 0.5], ['Components', 'Ines Park', 0.4]];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cat), 'Categories');
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

export function customersJson(): Uint8Array {
  return enc(JSON.stringify(CUSTOMERS.map(c => ({
    CustomerKey: c.id, FirstName: c.first, LastName: c.last, EmailAddress: c.email, BirthDate: iso(c.birth), Segment: c.segment,
    Address: { City: c.city, StateProvince: c.state, Country: c.country, Region: c.region },
  })), null, 2));
}

export function storesXml(): Uint8Array {
  const items = STORES.map(s => `  <Store>\n    <StoreKey>${s[0]}</StoreKey>\n    <StoreName>${s[1]}</StoreName>\n    <Region>${s[2]}</Region>\n    <City>${s[3]}</City>\n    <Manager>${s[4]}</Manager>\n    <ManagerEmail>${s[5]}</ManagerEmail>\n  </Store>`).join('\n');
  return enc(`<?xml version="1.0" encoding="utf-8"?>\n<Stores>\n${items}\n</Stores>\n`);
}

export function budgetCsv(): Uint8Array {
  const months = Array.from({ length: 12 }, (_, i) => new Date(2025, i, 1).toLocaleString('en-US', { month: 'short' }) + '-2025');
  const rows: any[][] = [['Region', 'Category', ...months]];
  const r = rng(99);
  for (const reg of ['North America', 'Europe', 'Pacific', 'Online']) for (const cat of Object.keys(cats)) {
    rows.push([reg, cat, ...months.map(() => Math.round((cat === 'Bikes' ? 40000 : 6000) * (0.7 + r() * 0.6)))]);
  }
  return enc(csv(rows));
}

export function employeesCsv(): Uint8Array {
  const rows: any[][] = [['EmployeeKey', 'EmployeeName', 'Title', 'ManagerKey', 'Region', 'Email', 'HireDate']];
  const people: [number, string, string, number | null, string, string, string][] = [
    [1, 'Morgan Blake', 'CEO', null, 'All', 'morgan@contoso.com', '2015-03-01'],
    [2, 'Alex Rivera', 'VP Sales North America', 1, 'North America', 'alex@contoso.com', '2016-06-15'],
    [3, 'Brooke Lee', 'VP Sales Europe', 1, 'Europe', 'brooke@contoso.com', '2017-01-09'],
    [4, 'Chris Ng', 'VP Sales Pacific', 1, 'Pacific', 'chris@contoso.com', '2018-09-03'],
    [5, 'Dana Ortiz', 'Head of Online', 1, 'Online', 'dana@contoso.com', '2019-02-11'],
    [6, 'Eli Novak', 'Store Manager', 2, 'North America', 'eli@contoso.com', '2020-05-20'],
    [7, 'Fatima Zahra', 'Store Manager', 3, 'Europe', 'fatima@contoso.com', '2021-11-01'],
    [8, 'George Kim', 'Sales Associate', 6, 'North America', 'george@contoso.com', '2022-08-08'],
    [9, 'Hiro Sato', 'Sales Associate', 7, 'Europe', 'hiro@contoso.com', '2023-04-17'],
  ];
  for (const p of people) rows.push(p.map(v => v ?? ''));
  return enc(csv(rows));
}

export function returnsTxt(): Uint8Array {
  const r = rng(3);
  const lines = ['ReturnID\tSalesOrderNumber\tReturnDate\tReason\tReturnQty'];
  for (let i = 1; i <= 120; i++) {
    const s = SALES[Math.floor(r() * SALES.length)];
    const d = new Date(s.date.getFullYear(), s.date.getMonth(), s.date.getDate() + 10 + Math.floor(r() * 20));
    lines.push([`R${1000 + i}`, `SO${s.order}`, us(d), ['Damaged', 'Wrong size', 'Changed mind', 'Late delivery'][Math.floor(r() * 4)], 1].join('\t'));
  }
  return enc(lines.join('\r\n'));
}

export function monthlyFiles(): StoredFile[] {
  const out: StoredFile[] = [];
  for (let m = 0; m < 3; m++) {
    const rows: any[][] = [['OrderNumber', 'OrderDate', 'ProductKey', 'Quantity', 'SalesAmount']];
    const r = rng(100 + m);
    for (let i = 0; i < 40; i++) {
      const p = PRODUCTS[Math.floor(r() * PRODUCTS.length)];
      const q = 1 + Math.floor(r() * 3);
      rows.push([`WEB${2501 + m}${pad(i, 3)}`, iso(new Date(2026, m, 1 + Math.floor(r() * 28))), p[0], q, (q * p[6]).toFixed(2)]);
    }
    out.push({ name: `WebSales_2026_${pad(m + 1)}.csv`, folder: `${ROOT_FOLDER}\\Monthly Web Sales`, bytes: enc(csv(rows)), modified: new Date(2026, m + 1, 1).getTime() });
  }
  return out;
}

export function sampleFiles(): StoredFile[] {
  const t = new Date(2026, 0, 2).getTime();
  return [
    { name: 'Sales.csv', folder: ROOT_FOLDER, bytes: salesCsv(), modified: t },
    { name: 'Products.xlsx', folder: ROOT_FOLDER, bytes: productsXlsx(), modified: t },
    { name: 'Customers.json', folder: ROOT_FOLDER, bytes: customersJson(), modified: t },
    { name: 'Stores.xml', folder: ROOT_FOLDER, bytes: storesXml(), modified: t },
    { name: 'Budget 2025.csv', folder: ROOT_FOLDER, bytes: budgetCsv(), modified: t },
    { name: 'Employees.csv', folder: ROOT_FOLDER, bytes: employeesCsv(), modified: t },
    { name: 'Returns.txt', folder: ROOT_FOLDER, bytes: returnsTxt(), modified: t },
    ...monthlyFiles(),
  ];
}

// ---------- the sandbox SQL Server: Sql.Database("localhost", "ContosoDW") ----------
let sqlNav: MTable | null = null;
export const LAKEHOUSE_SERVER = 'contoso-sandbox.datawarehouse.fabric.microsoft.com';
export const LAKEHOUSE_DB = 'ContosoLakehouse';
export function contosoDW(server: string, db: string): MTable | undefined {
  const lake = /\.(datawarehouse|pbidedicated)\.fabric\.microsoft\.com$/i.test(server.trim()) && /^contosolakehouse$/i.test(db.trim());
  if (!lake && (!/^(localhost|\.|\(local\)|127\.0\.0\.1|sandbox)$/i.test(server.trim()) || !/^contosodw$/i.test(db.trim()))) return undefined;
  if (sqlNav) return sqlNav;
  const tbl = (cols: [string, DataType][], rows: any[][]) => new MTable(cols.map(([name, type]) => ({ name, type })), rows);
  const dates: any[][] = [];
  for (let d = new Date(2023, 0, 1); d <= new Date(2025, 11, 31); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    dates.push([d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(), d, d.getFullYear(), Math.floor(d.getMonth() / 3) + 1, d.getMonth() + 1, d.toLocaleString('en-US', { month: 'long' }), d.getDay() + 1, d.toLocaleString('en-US', { weekday: 'long' })]);
  }
  const tables: [string, MTable][] = [
    ['DimProduct', tbl([['ProductKey', 'int'], ['ProductName', 'text'], ['Category', 'text'], ['Subcategory', 'text'], ['Color', 'text'], ['StandardCost', 'currency'], ['ListPrice', 'currency']], PRODUCTS.map(p => [...p]))],
    ['DimCustomer', tbl([['CustomerKey', 'int'], ['FirstName', 'text'], ['LastName', 'text'], ['EmailAddress', 'text'], ['City', 'text'], ['StateProvince', 'text'], ['Country', 'text'], ['Region', 'text'], ['BirthDate', 'date'], ['Segment', 'text']],
      CUSTOMERS.map(c => [c.id, c.first, c.last, c.email, c.city, c.state, c.country, c.region, c.birth, c.segment]))],
    ['DimStore', tbl([['StoreKey', 'int'], ['StoreName', 'text'], ['Region', 'text'], ['City', 'text'], ['Manager', 'text'], ['ManagerEmail', 'text']], STORES.map(s => [...s]))],
    ['DimDate', tbl([['DateKey', 'int'], ['Date', 'date'], ['CalendarYear', 'int'], ['CalendarQuarter', 'int'], ['MonthNumber', 'int'], ['MonthName', 'text'], ['DayOfWeekNumber', 'int'], ['DayName', 'text']], dates)],
    ['FactSales', tbl([['SalesOrderNumber', 'text'], ['SalesOrderLineNumber', 'int'], ['OrderDateKey', 'int'], ['ShipDateKey', 'int'], ['CustomerKey', 'int'], ['ProductKey', 'int'], ['StoreKey', 'int'], ['OrderQuantity', 'int'], ['UnitPrice', 'currency'], ['DiscountPct', 'decimal'], ['SalesAmount', 'currency'], ['TotalProductCost', 'currency']],
      SALES.map(s => { const p = PRODUCTS[s.prod - 1]; const key = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); return [`SO${s.order}`, s.line, key(s.date), key(s.ship), s.cust, s.prod, s.store, s.qty, s.price, s.disc, Math.round(s.qty * s.price * (1 - s.disc) * 100) / 100, Math.round(s.qty * p[5] * 100) / 100]; }))],
  ];
  sqlNav = new MTable([{ name: 'Name', type: 'text' }, { name: 'Data', type: 'table' }, { name: 'Schema', type: 'text' }, { name: 'Item', type: 'text' }, { name: 'Kind', type: 'text' }],
    tables.map(([n, t]) => [`dbo.${n}`, t, 'dbo', n, 'Table']));
  return sqlNav;
}
