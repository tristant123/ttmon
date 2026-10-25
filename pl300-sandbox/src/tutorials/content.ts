// PL-300 tutorials. Each one loads its own data, guides the task step by step with live checks,
// and ends with exam-style questions.
import { store } from '../store';
import { MEngine } from '../m/engine';
import { MTable } from '../core/values';
import { loadScenario, starScenario, M, T, F, DATE_TABLE, STAR_MEASURES } from './scenarios';
import { emptyCtx } from '../dax/engine';

export type Area = 'Prepare the data' | 'Model the data' | 'Visualize and analyze the data' | 'Manage and secure Power BI';
export interface Step { title: string; html: string; check?: () => boolean; hint?: string }
export interface Quiz { q: string; options: string[]; answer: number; why: string }
export interface Tutorial { id: string; area: Area; title: string; summary: string; minutes: number; setup: () => Promise<void>; steps: Step[]; quiz: Quiz[] }

// ---------- check helpers ----------
const queries = () => (store.ui.pq ? store.ui.pq.queries : store.project.queries);
const code = (name: string) => queries().find(q => q.name.toLowerCase() === name.toLowerCase())?.code ?? '';
const anyCode = (re: RegExp) => queries().some(q => re.test(q.code));
function evalQ(name: string): MTable | null {
  try { const v = new MEngine(queries()).evaluateQuery(queries().find(q => q.name.toLowerCase() === name.toLowerCase())?.name ?? name); return v instanceof MTable ? v : null; } catch { return null; }
}
function anyTable(pred: (t: MTable, name: string) => boolean): boolean {
  const eng = new MEngine(queries());
  return queries().some(q => { try { const v = eng.evaluateQuery(q.name); return v instanceof MTable && pred(v, q.name); } catch { return false; } });
}
const tbl = (n: string) => store.project.model.tables.find(t => t.name.toLowerCase() === n.toLowerCase());
const measure = (re: RegExp) => store.project.model.measures.find(m => re.test(m.expression) || re.test(m.name));
const dax = (expr: string) => { try { return store.dax.scalarOf(expr); } catch { return undefined; } };
const rel = (from: string, to: string) => store.project.model.relationships.find(r => r.fromTable === from && r.toTable === to);
const pageVisuals = () => store.project.report.pages.flatMap(p => p.visuals);
const loaded = (n: string) => !!tbl(n);

const tip = (t: string) => `<div class="tip"><b>Exam tip</b>${t}</div>`;
const d = (n: number) => new Date(2025, 0, n);

export const TUTORIALS: Tutorial[] = [
  // ======================= PREPARE THE DATA =======================
  {
    id: 'getdata', area: 'Prepare the data', title: 'Get data from files and clean the header rows', minutes: 8,
    summary: 'Import an Excel sheet that has title rows above the headers, promote headers, and set data types.',
    setup: () => loadScenario('Get data', { queries: [] }),
    steps: [
      { title: 'Connect to Excel', html: `<p>On the <b>Home</b> ribbon select <b>Excel workbook</b>, choose <code>Products.xlsx</code> from the sandbox files, tick the <b>Products</b> sheet in the Navigator and select <b>Transform Data</b>.</p><p>Power Query opens. Notice the first rows are a report title, a note and a blank row, not data.</p>`, check: () => anyCode(/Excel\.Workbook/) },
      { title: 'Remove the top rows', html: `<p>Select <b>Home › Remove Rows › Remove Top Rows</b> and remove <b>3</b> rows (the title, the note and the blank row). If Power Query already added <i>Promoted Headers</i> and <i>Changed Type</i> steps, select the step called <code>Products_Sheet</code> first so the new step goes right after it, or delete the extra steps.</p>`, check: () => anyCode(/Table\.Skip\([^,]+,\s*3\)|Table\.RemoveFirstN\([^,]+,\s*3\)/) },
      { title: 'Use first row as headers', html: `<p>Select <b>Home › Use First Row as Headers</b>. Power Query adds <i>Promoted Headers</i> and usually an automatic <i>Changed Type</i> step.</p>`, check: () => anyTable(t => t.names.includes('ProductKey') && t.names.includes('List Price')) },
      { title: 'Check the data types', html: `<p>Look at the type badge left of each column name. Set <b>ProductKey</b> to Whole Number and <b>Standard Cost</b> / <b>List Price</b> to Fixed Decimal Number (click the badge). Then <b>Close &amp; Apply</b>.</p>${tip('"Changed Type" steps are added automatically after promoting headers. If a later step renames a column, an earlier Changed Type step that refers to the old name fails with <i>Expression.Error: The column … wasn\'t found</i>.')}`, check: () => !!tbl('Products') && tbl('Products')!.columns.some(c => c.name === 'List Price' && (c.dataType === 'currency' || c.dataType === 'decimal')) || !!store.project.model.tables.find(t => t.columns.some(c => c.name === 'List Price' && c.dataType === 'currency')) },
    ],
    quiz: [
      { q: 'An Excel sheet has three rows of title text above the real column headers. Which two steps, in order, prepare it?', options: ['Use First Row as Headers, then Remove Top Rows', 'Remove Top Rows, then Use First Row as Headers', 'Transpose, then Remove Top Rows', 'Remove Blank Rows, then Fill Down'], answer: 1, why: 'Remove the 3 title rows first (Table.Skip), so the header row becomes the first row, then promote it (Table.PromoteHeaders).' },
      { q: 'You select "Load" instead of "Transform Data" in the Navigator. What happens?', options: ['Nothing is imported until you refresh', 'Data loads to the model with the steps Power Query generated automatically', 'The data is linked live with DirectQuery', 'Power Query opens'], answer: 1, why: 'Load applies the default steps (Source, Navigation, Promoted Headers, Changed Type) and loads the table. Transform Data opens Power Query first.' },
    ],
  },
  {
    id: 'profile', area: 'Prepare the data', title: 'Profile data and fix errors, nulls and duplicates', minutes: 10,
    summary: 'Use column quality, distribution and profile; then remove errors, replace nulls and remove duplicates.',
    setup: () => loadScenario('Profile and clean', { queries: [{ name: 'Sales', code: M.salesRaw }], openPQ: 'Sales' }),
    steps: [
      { title: 'Turn on profiling', html: `<p>In Power Query open the <b>View</b> tab and tick <b>Column quality</b>, <b>Column distribution</b> and <b>Column profile</b>. Each column header now shows Valid / Error / Empty percentages.</p><p>Change profiling from <b>top 1000 rows</b> to <b>entire data set</b> using the status bar at the bottom. Small problems can hide beyond row 1000.</p>`, check: () => !!store.ui.pq && (store.ui.pq.profile.quality || store.ui.pq.profile.profile) },
      { title: 'Find the errors', html: `<p>The <b>UnitPrice</b> column has errors: the CSV contains <code>N/A</code> in a few rows, and the <i>Changed Type</i> step can't turn that into a number. Click an <b>Error</b> cell to see <i>DataFormat.Error: We couldn't convert to Number.</i></p><p>Select the UnitPrice column, then <b>Home › Remove Rows › Remove Errors</b> (or <b>Transform › Replace Values › Replace Errors</b> with 0 if you must keep the rows).</p>`, check: () => /RemoveRowsWithErrors|ReplaceErrorValues/.test(code('Sales')) },
      { title: 'Handle nulls', html: `<p><b>OrderQuantity</b> has a few empty values, which became <code>null</code>. Select the column, choose <b>Transform › Replace Values</b>, find <code>null</code> and replace with <code>1</code>.</p>`, check: () => /ReplaceValue\([^)]*null[^)]*"?OrderQuantity/.test(code('Sales')) || /ReplaceValue\(.*null.*OrderQuantity/s.test(code('Sales')) },
      { title: 'Remove duplicate rows', html: `<p>Two order lines appear twice at the end of the file. Click the table icon at the top-left of the grid (or select no columns) and choose <b>Home › Remove Rows › Remove Duplicates</b>.</p>${tip('Remove Duplicates with columns selected only compares those columns (Table.Distinct(Source, {"Col"})). To deduplicate whole rows, select all columns or none.')}`, check: () => /Table\.Distinct\(/.test(code('Sales')) },
      { title: 'Apply', html: `<p>Select <b>Close &amp; Apply</b>. The table loads without errors. Check the row count in <b>Table view</b> (the status bar).</p>`, check: () => !!tbl('Sales') && !store.ui.pq && !tbl('Sales')!.loadErrors },
    ],
    quiz: [
      { q: 'Column quality shows "Error 1%" for a column. Which statement is true?', options: ['The source file is corrupt', 'Some values couldn\'t be converted by a step, often a Changed Type step', 'The column contains nulls', 'The column has duplicate values'], answer: 1, why: 'Errors are cell-level: a step (frequently Changed Type) failed for those values. Empty counts nulls/blanks; distribution shows distinct/unique.' },
      { q: 'By default, column profiling in Power Query is based on…', options: ['The entire data set', 'The top 1,000 rows', 'A random 10% sample', 'The first 200 rows'], answer: 1, why: 'Profiling defaults to the top 1,000 rows. Switch to "Column profiling based on entire data set" from the status bar.' },
      { q: 'You need to keep rows that have an error but show 0 instead. Which command?', options: ['Remove Errors', 'Replace Errors', 'Keep Errors', 'Fill Down'], answer: 1, why: 'Replace Errors (Table.ReplaceErrorValues) substitutes a value for error cells while keeping the rows.' },
    ],
  },
  {
    id: 'merge', area: 'Prepare the data', title: 'Merge queries: all six join kinds', minutes: 12,
    summary: 'Join Orders to Customers with Left Outer, Inner, Full Outer, Left Anti and Right Anti, and expand the result.',
    setup: () => loadScenario('Merge queries', {
      files: false,
      queries: [
        { name: 'Orders', code: T([['OrderID', 'Int64.Type'], ['CustomerID', 'Int64.Type'], ['OrderDate', 'date'], ['Amount', 'number']], [[1, 101, d(3), 250], [2, 102, d(4), 120], [3, 101, d(9), 80], [4, 104, d(12), 410], [5, 999, d(15), 65], [6, 103, d(20), 199]]) },
        { name: 'Customers', code: T([['CustomerID', 'Int64.Type'], ['Name', 'text'], ['Country', 'text']], [[101, 'Ana Smith', 'Canada'], [102, 'Ben Chen', 'United States'], [103, 'Chloe Rossi', 'Italy'], [104, 'Diego Silva', 'Brazil'], [105, 'Emma Novak', 'Czechia']]) },
      ], openPQ: 'Orders',
    }),
    steps: [
      { title: 'Look at the two tables', html: `<p><b>Orders</b> has 6 rows. Order 5 belongs to customer <b>999</b>, who doesn't exist. <b>Customers</b> has 5 rows. Customer <b>105</b> (Emma) has no orders. These two "orphans" are what each join kind treats differently.</p>` },
      { title: 'Left Outer merge', html: `<p>With <b>Orders</b> selected choose <b>Home › Merge Queries</b>. Pick <b>Customers</b> as the second table, click <b>CustomerID</b> in both previews, keep <b>Left Outer</b> and select OK. A <code>Customers</code> column of nested tables appears.</p><p>Click the expand icon in its header and keep <b>Name</b> and <b>Country</b>. Order 5 gets <code>null</code> for Name: Left Outer keeps every row of the first table.</p>`, check: () => /NestedJoin\(.*JoinKind\.LeftOuter/s.test(code('Orders')) && /ExpandTableColumn/.test(code('Orders')) },
      { title: 'Left Anti: find orphan orders', html: `<p>Choose <b>Home › Merge Queries › Merge Queries as New</b>. Use Orders and Customers on CustomerID again, and set <b>Join Kind</b> to <b>Left Anti</b>. The result has one row: order 5, whose customer doesn't exist.</p>${tip('"Which orders have no matching customer?" → Left Anti. "Which customers never ordered?" → Right Anti (Customers second) or Left Anti with Customers first.')}`, check: () => anyTable(t => t.rows.length === 1 && t.names.includes('OrderID')) && anyCode(/JoinKind\.LeftAnti/) },
      { title: 'Right Anti: customers without orders', html: `<p>Create another <b>Merge Queries as New</b>, this time <b>Right Anti</b>. It returns rows from the <i>second</i> table with no match. Expand the nested column to see <b>Emma Novak</b> (105). The Orders columns are null.</p>`, check: () => anyCode(/JoinKind\.RightAnti/) },
      { title: 'Compare Inner and Full Outer', html: `<p>Try <b>Inner</b> (5 rows: only matches) and <b>Full Outer</b> (7 rows: all orders plus Emma). Watch the "The selection matches N of M rows" message in the Merge dialog; it's how you spot key problems before merging.</p>`, check: () => anyCode(/JoinKind\.Inner/) && anyCode(/JoinKind\.FullOuter/) },
      { title: 'Load only what you need', html: `<p>Right-click the helper merge queries and untick <b>Enable load</b> if you only used them to explore. Then <b>Close &amp; Apply</b>.</p>${tip('Merge = add columns from another table (like a SQL JOIN / Excel XLOOKUP). Append = add rows (like UNION). Merging on columns of different data types (text "101" vs number 101) matches nothing.')}` },
    ],
    quiz: [
      { q: 'You need every customer, with their orders where they exist. Customers is the first table. Which join kind?', options: ['Inner', 'Left Outer', 'Right Anti', 'Left Anti'], answer: 1, why: 'Left Outer keeps all rows of the first table (Customers) and brings matches from the second; customers without orders get nulls.' },
      { q: 'Which join returns only rows from the first table that have NO match in the second?', options: ['Left Outer', 'Right Outer', 'Left Anti', 'Full Outer'], answer: 2, why: 'Left Anti = first-table rows without a match. Right Anti = second-table rows without a match.' },
      { q: 'A merge on CustomerID matches 0 rows although the IDs look identical. Most likely cause?', options: ['The tables are in different queries', 'One column is Text and the other is Whole Number', 'Fuzzy matching is off', 'The join kind is Left Outer'], answer: 1, why: 'Keys must share a data type. "101" (text) never equals 101 (number). Change one column\'s type first.' },
    ],
  },
  {
    id: 'append', area: 'Prepare the data', title: 'Append queries and fix mismatched columns', minutes: 8,
    summary: 'Stack two years of sales, see why mismatched column names create nulls, and fix them before appending.',
    setup: () => loadScenario('Append queries', {
      files: false,
      queries: [
        { name: 'Sales 2024', code: T([['OrderID', 'Int64.Type'], ['Region', 'text'], ['SalesAmount', 'number']], [[1, 'North', 100], [2, 'South', 250], [3, 'West', 75], [4, 'North', 310]]) },
        { name: 'Sales 2025', code: T([['OrderID', 'Int64.Type'], ['Region', 'text'], ['Amount', 'number']], [[5, 'South', 180], [6, 'West', 90], [7, 'North', 400]]) },
        { name: 'Sales 2026', code: T([['OrderID', 'Int64.Type'], ['Region', 'text'], ['SalesAmount', 'number']], [[8, 'East', 55], [9, 'South', 120]]) },
      ], openPQ: 'Sales 2024',
    }),
    steps: [
      { title: 'Append as new', html: `<p>Select <b>Sales 2024</b>, then <b>Home › Append Queries › Append Queries as New</b>. Choose <b>Two tables</b> and append <b>Sales 2025</b>.</p><p>The new <code>Append1</code> query has 7 rows but <b>four</b> columns: <code>SalesAmount</code> is null for 2025 rows and <code>Amount</code> is null for 2024 rows. Append matches columns <b>by name</b>.</p>`, check: () => anyCode(/Table\.Combine\(/) },
      { title: 'Fix the column name at the source', html: `<p>Select <b>Sales 2025</b>, double-click the <b>Amount</b> header and rename it <code>SalesAmount</code>. Go back to <b>Append1</b>: it now has three clean columns.</p>`, check: () => anyTable((t, n) => /append/i.test(n) && t.names.length === 3 && t.names.includes('SalesAmount')) },
      { title: 'Three or more tables', html: `<p>With <b>Append1</b> selected choose <b>Append Queries</b> (not as new), pick <b>Three or more tables</b>, and add <b>Sales 2026</b>. You should have 9 rows.</p>${tip('Append = add rows (Table.Combine). The tables don\'t need the same column order, only the same names. Use "Append Queries as New" when you want to keep the originals as staging queries (and disable their load).')}`, check: () => anyTable((t, n) => /append/i.test(n) && t.rows.length === 9) },
      { title: 'Disable load on the staging queries', html: `<p>Right-click <b>Sales 2024</b>, <b>Sales 2025</b> and <b>Sales 2026</b> in the Queries pane and untick <b>Enable load</b>. Their names turn italic. Only <b>Append1</b> becomes a model table when you <b>Close &amp; Apply</b>.</p>`, check: () => queries().filter(q => /^Sales 20/.test(q.name)).every(q => !q.load) },
    ],
    quiz: [
      { q: 'You append Table A (columns ID, Amount) and Table B (ID, SalesAmount). How many columns does the result have?', options: ['2', '3', '4', 'An error occurs'], answer: 1, why: 'Columns are matched by name: ID, Amount, SalesAmount. Rows from each table get null in the column they don\'t have.' },
      { q: 'You want to combine monthly files with identical structure into one table, and new files should be picked up automatically. Best approach?', options: ['Append each file manually', 'Get data › Folder › Combine & Transform', 'Merge the files', 'Enter data'], answer: 1, why: 'The Folder connector with Combine Files builds a function applied to every file in the folder, so new files are included on refresh.' },
    ],
  },
  {
    id: 'folder', area: 'Prepare the data', title: 'Combine files from a folder', minutes: 8,
    summary: 'Use the Folder connector and Combine & Transform to stack three monthly CSV files, keeping the file name.',
    setup: () => loadScenario('Combine files', { queries: [] }),
    steps: [
      { title: 'Connect to the folder', html: `<p>Select <b>Get data › Folder</b>, choose <code>${F('Monthly Web Sales')}</code> and look at the file list: one row per file with a <b>Content</b> (Binary) column.</p><p>Select <b>Combine &amp; Transform Data</b>.</p>`, check: () => anyCode(/Folder\.Files/) },
      { title: 'Read the helper queries', html: `<p>Power Query created a group <b>Transform File from …</b> with:</p><ul><li><b>Sample File</b>: the first file's binary</li><li><b>Transform File</b>: a function <code>(Parameter1 as binary) =&gt; …</code> that turns one file into a table</li></ul><p>The main query invokes the function on every file (<code>Table.AddColumn(…, each #"Transform File"([Content]))</code>) and expands the result. Changes you make to the sample/function apply to every file.</p>`, check: () => queries().some(q => q.name === 'Transform File') },
      { title: 'Keep the source file name', html: `<p>The combined table starts with a <b>Source.Name</b> column (the file name). Select it, choose <b>Transform › Extract › Text Between Delimiters</b> with start <code>_</code> and end <code>.csv</code>… or simply keep it to know which month each row came from.</p><p>Check the row count in the status bar: 120 rows (40 per file).</p>`, check: () => anyTable(t => t.rows.length === 120 && t.names.includes('Source.Name')) },
    ],
    quiz: [
      { q: 'After Combine Files, you need to remove the first row of every file. Where should you add the step?', options: ['In the combined query, after expanding', 'In the Transform Sample File query (it updates the function)', 'In the Sample File query', 'In each file before importing'], answer: 1, why: 'Steps in "Transform Sample File" flow into the Transform File function, so they run per file before the files are combined.' },
    ],
  },
  {
    id: 'unpivot', area: 'Prepare the data', title: 'Unpivot a wide budget table (and pivot it back)', minutes: 8,
    summary: 'Turn one column per month into rows with Unpivot Other Columns, then convert the month text to a date.',
    setup: () => loadScenario('Unpivot', { queries: [{ name: 'Budget', code: `let\n    Source = Csv.Document(File.Contents("${F('Budget 2025.csv')}"),[Delimiter=",", Columns=14, Encoding=65001, QuoteStyle=QuoteStyle.None]),\n    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true])\nin\n    #"Promoted Headers"` }], openPQ: 'Budget' }),
    steps: [
      { title: 'Why unpivot?', html: `<p>The budget has <b>Region</b>, <b>Category</b> and twelve month columns. That shape is easy to read but hard to model: you can't relate it to a Date table or slice by month.</p>` },
      { title: 'Unpivot Other Columns', html: `<p>Ctrl+click the <b>Region</b> and <b>Category</b> headers, then right-click › <b>Unpivot Other Columns</b>. You get <b>Attribute</b> (month text) and <b>Value</b> columns with 16 × 12 = 192 rows.</p>${tip('Prefer <b>Unpivot Other Columns</b>: it lists the columns to keep, so when a new month column appears next refresh it\'s unpivoted too. "Unpivot Only Selected Columns" hard-codes the month names.')}`, check: () => /UnpivotOtherColumns/.test(code('Budget')) && (evalQ('Budget')?.rows.length ?? 0) === 192 },
      { title: 'Tidy the result', html: `<p>Rename <b>Attribute</b> to <code>Month</code> and <b>Value</b> to <code>Budget</code>. Change <b>Month</b> to type <b>Date</b> (text like <i>Jan-2025</i> becomes 1/1/2025) and <b>Budget</b> to Whole Number.</p>`, check: () => { const t = evalQ('Budget'); return !!t && t.names.includes('Month') && t.columns.find(c => c.name === 'Month')?.type === 'date'; } },
      { title: 'Pivot it back (optional)', html: `<p>To see the reverse, select <b>Month</b> and choose <b>Transform › Pivot Column</b>, values column <b>Budget</b>, aggregation <b>Sum</b>. Delete that step afterwards to keep the long format.</p>` },
    ],
    quiz: [
      { q: 'A table has columns Product, Jan, Feb, Mar… New month columns are added every month. Which transformation keeps working on refresh?', options: ['Select Jan–Dec and Unpivot Columns', 'Select Product and Unpivot Other Columns', 'Transpose', 'Pivot Column on Product'], answer: 1, why: 'Unpivot Other Columns stores only the columns to keep (Product), so new month columns are unpivoted automatically.' },
      { q: 'Unpivot produces which two new columns by default?', options: ['Name and Value', 'Attribute and Value', 'Key and Data', 'Column and Row'], answer: 1, why: 'Table.UnpivotOtherColumns(…, "Attribute", "Value").' },
    ],
  },
  {
    id: 'groupby', area: 'Prepare the data', title: 'Group By, conditional and custom columns', minutes: 10,
    summary: 'Summarize sales per customer with Group By, then classify customers with a conditional column.',
    setup: () => loadScenario('Group by', { queries: [{ name: 'Sales', code: M.salesClean }], openPQ: 'Sales' }),
    steps: [
      { title: 'Add a custom column', html: `<p><b>Add Column › Custom Column</b>: name it <code>Line Total</code> with formula <code>[OrderQuantity] * [UnitPrice]</code>. IntelliSense suggests column names as you type <code>[</code>.</p>`, check: () => /AddColumn\([^,]+,\s*"Line Total"/.test(code('Sales')) },
      { title: 'Group by customer (advanced)', html: `<p><b>Transform › Group By</b>, choose <b>Advanced</b>. Group by <b>CustomerKey</b> and add two aggregations:</p><ul><li><code>Total</code> = <b>Sum</b> of <b>Line Total</b></li><li><code>Orders</code> = <b>Count Rows</b></li></ul>`, check: () => /Table\.Group\(/.test(code('Sales')) && /List\.Sum\(\[Line Total\]\)/.test(code('Sales')) },
      { title: 'Conditional column', html: `<p><b>Add Column › Conditional Column</b> named <code>Tier</code>: If <b>Total</b> is greater than or equal to <code>5000</code> then <code>Gold</code>; Else If <b>Total</b> ≥ <code>2000</code> then <code>Silver</code>; Else <code>Bronze</code>. Open the formula bar to read the generated <code>if … then … else</code>.</p>${tip('Group By keeps only the grouped and aggregated columns: every other column disappears. If you need the details too, add an "All Rows" aggregation and expand it.')}`, check: () => /if .*Total.* then "Gold"/.test(code('Sales')) },
    ],
    quiz: [
      { q: 'After Group By on CustomerKey with a Sum of Amount, what happens to the other columns?', options: ['They are kept with their first value', 'They are removed', 'They become nested lists', 'They are summed'], answer: 1, why: 'Only the group-by columns and the new aggregate columns remain. Use the All Rows operation to keep the detail as a nested table.' },
    ],
  },
  {
    id: 'params', area: 'Prepare the data', title: 'Parameters and custom functions', minutes: 10,
    summary: 'Make a query filter driven by a parameter, then create and invoke a custom function.',
    setup: () => loadScenario('Parameters', { queries: [{ name: 'Customer', code: M.customer }], openPQ: 'Customer' }),
    steps: [
      { title: 'Create a parameter', html: `<p><b>Home › Manage Parameters › New Parameter</b>. Name <code>RegionParam</code>, Type <b>Text</b>, Current Value <code>Europe</code>. It appears as a query with a special icon.</p>`, check: () => queries().some(q => /IsParameterQuery=true/.test(q.code)) },
      { title: 'Use it in a filter', html: `<p>Select <b>Customer</b>, open the <b>Region</b> column's filter dropdown, choose <b>Text Filters › Equals</b> and enter anything. Then in the formula bar replace the text value with <code>RegionParam</code>, e.g. <code>Table.SelectRows(#"Inserted Merged Column", each ([Region] = RegionParam))</code>.</p><p>Change the parameter's value to <code>Pacific</code> and watch the Customer preview change.</p>${tip('Parameters are typically used to switch data source paths or servers (dev/test/prod), and they can be edited in Desktop with Home › Transform data › Edit parameters, or in the service in the semantic model settings.')}`, check: () => /RegionParam/.test(code('Customer')) },
      { title: 'Create a function', html: `<p>New blank query (<b>Home › New Source › Blank Query</b>), open the <b>Advanced Editor</b> and enter:</p><pre>(birth as date) as number =&gt;\n    Date.Year(DateTime.LocalNow()) - Date.Year(birth)</pre><p>Rename the query <code>fnAge</code>.</p>`, check: () => queries().some(q => /=>/.test(q.code) && /Date\.Year/.test(q.code)) },
      { title: 'Invoke it per row', html: `<p>Select <b>Customer</b> and choose <b>Add Column › Invoke Custom Function</b>: function <b>fnAge</b>, argument column <b>BirthDate</b>. Each row gets an <b>Age</b>.</p>`, check: () => /AddColumn\(.*each\s+\w*fn\w*\(\[BirthDate\]\)/s.test(code('Customer')) },
    ],
    quiz: [
      { q: 'You deploy the same report to Dev and Prod with different SQL servers. Best practice?', options: ['Duplicate the queries', 'Create a text parameter for the server and use it in Sql.Database', 'Use DirectQuery', 'Edit the M code before each publish'], answer: 1, why: 'A parameter for the server name lets you switch sources without editing queries, including from the service and deployment pipelines.' },
    ],
  },
  {
    id: 'reference', area: 'Prepare the data', title: 'Reference vs Duplicate, and query load options', minutes: 6,
    summary: 'See how Reference reuses another query\'s output while Duplicate copies its steps.',
    setup: () => loadScenario('Reference vs duplicate', { queries: [{ name: 'Sales Staging', code: M.salesClean }], openPQ: 'Sales Staging' }),
    steps: [
      { title: 'Reference', html: `<p>Right-click <b>Sales Staging</b> › <b>Reference</b>. The new query has one step: <code>Source = #"Sales Staging"</code>. Group it by <b>StoreKey</b> (Sum of SalesAmount).</p>`, check: () => queries().some(q => /Source = #"Sales Staging"/.test(q.code)) },
      { title: 'Duplicate', html: `<p>Right-click <b>Sales Staging</b> › <b>Duplicate</b>. The copy has <i>all</i> the same steps. Editing the original later won't change the duplicate, but it changes everything that references it.</p>`, check: () => queries().filter(q => /Csv\.Document/.test(q.code)).length >= 2 },
      { title: 'View dependencies', html: `<p><b>View › Query Dependencies</b> shows the file source feeding Sales Staging and your reference query.</p><p>Disable load on <b>Sales Staging</b> (right-click › Enable load) so it doesn't create a model table.</p>${tip('Reference = new query whose source is another query\'s result (changes flow through). Duplicate = independent copy of all steps. Disable load for staging queries to keep the model lean.')}`, check: () => queries().some(q => q.name === 'Sales Staging' && !q.load) },
    ],
    quiz: [
      { q: 'You need several queries that all start from the same cleaned table, and fixes to the cleaning should apply to all of them. Use…', options: ['Duplicate', 'Reference', 'Append', 'Merge'], answer: 1, why: 'Referenced queries start from the base query\'s output, so changes to the base flow to all of them.' },
    ],
  },

  // ======================= MODEL THE DATA =======================
  {
    id: 'star', area: 'Model the data', title: 'Build a star schema: relationships, cardinality, cross-filter', minutes: 12,
    summary: 'Relate a fact table to dimensions in Model view and learn what 1:*, 1:1, *:* and filter direction mean.',
    setup: () => loadScenario('Star schema', { queries: [{ name: 'Sales', code: M.salesClean }, { name: 'Product', code: M.productClean }, { name: 'Customer', code: M.customer }, { name: 'Store', code: M.store }], measures: [STAR_MEASURES[0]], view: 'model', visuals: [{ type: 'clusteredBar', x: 20, y: 20, w: 600, h: 400, wells: { axis: [{ table: 'Product', column: 'Category' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } }] }),
    steps: [
      { title: 'Facts and dimensions', html: `<p><b>Sales</b> is the <b>fact</b> table: one row per order line with numeric values and foreign keys. <b>Product</b>, <b>Customer</b> and <b>Store</b> are <b>dimensions</b>: one row per thing, with descriptive columns. A star schema puts the fact in the middle.</p><p>Autodetect is off, so there are no relationships yet. Go to <b>Report view</b>: the bar chart shows the same total for every Category. Without a relationship, Product can't filter Sales.</p>` },
      { title: 'Create Sales → Product', html: `<p>In <b>Model view</b>, drag <b>ProductKey</b> from <b>Sales</b> onto <b>ProductKey</b> in <b>Product</b>. The line shows <b>*</b> on Sales and <b>1</b> on Product (many-to-one), with an arrow from Product to Sales: filters flow from the one side to the many side.</p>`, check: () => !!rel('Sales', 'Product') },
      { title: 'Create the other relationships', html: `<p>Relate <b>Sales[CustomerKey]</b> → <b>Customer[CustomerKey]</b> and <b>Sales[StoreKey]</b> → <b>Store[StoreKey]</b>. Or open <b>Manage relationships › Autodetect</b>.</p><p>Back in Report view, the bar chart now splits by category.</p>`, check: () => !!rel('Sales', 'Customer') && !!rel('Sales', 'Store') },
      { title: 'Inspect a relationship', html: `<p>Double-click the Sales–Store line. Review <b>Cardinality</b> (Many to one) and <b>Cross-filter direction</b> (Single). Try setting Many to one on a column with duplicates (e.g. Store[Region]): the sandbox explains why it's invalid, as Power BI does.</p>${tip('Single direction (dimension filters fact) is the default and recommended. Use Both only when needed (e.g. a bridge table in many-to-many) because it can create ambiguous paths and slower queries. Relationships need matching data types.')}`, check: () => store.project.model.relationships.length >= 3 },
    ],
    quiz: [
      { q: 'In a relationship between Product (one) and Sales (many) with Single cross-filter direction, which statement is true?', options: ['Filtering Sales filters Product', 'Filtering Product filters Sales', 'Both filter each other', 'Neither filters the other'], answer: 1, why: 'Filters propagate from the one side to the many side by default.' },
      { q: 'A visual shows the same value for every category. What\'s the most likely cause?', options: ['The measure uses SUMX', 'There is no (active) relationship between the category table and the fact table', 'Auto date/time is on', 'The column is hidden'], answer: 1, why: 'Without a relationship path the category filter never reaches the fact table, so each row repeats the grand total.' },
      { q: 'Two tables each have a column with unique values that match one-to-one. Which cardinality?', options: ['Many to one', 'One to one', 'Many to many', 'One to many'], answer: 1, why: 'Unique on both sides = 1:1, which Power BI sets with Both cross-filter direction.' },
    ],
  },
  {
    id: 'dates', area: 'Model the data', title: 'Create a Date table and mark it as a date table', minutes: 10,
    summary: 'Build a calendar with DAX, add columns, sort month names correctly, mark it as a date table and relate it.',
    setup: () => loadScenario('Date table', { queries: [{ name: 'Sales', code: M.salesClean }], measures: [STAR_MEASURES[0]], view: 'table' }),
    steps: [
      { title: 'New table with CALENDAR', html: `<p>In <b>Table view</b> select <b>New table</b> and enter:</p><pre>Date = CALENDAR(DATE(2023,1,1), DATE(2025,12,31))</pre><p>Or use <code>CALENDARAUTO()</code>, which scans every date column in the model and covers whole years.</p>`, check: () => !!tbl('Date') && tbl('Date')!.rows.length >= 365 },
      { title: 'Add calendar columns', html: `<p>With the Date table selected, add <b>New column</b>s:</p><pre>Year = YEAR('Date'[Date])\nMonth Number = MONTH('Date'[Date])\nMonth = FORMAT('Date'[Date], "mmm")</pre>`, check: () => !!tbl('Date')?.columns.some(c => c.name === 'Month') && !!tbl('Date')?.columns.some(c => c.name === 'Month Number') },
      { title: 'Sort Month by Month Number', html: `<p>Select the <b>Month</b> column and on <b>Column tools</b> choose <b>Sort by column › Month Number</b>. Without it, visuals sort months alphabetically (Apr, Aug, Dec…).</p>`, check: () => tbl('Date')?.columns.find(c => c.name === 'Month')?.sortByColumn === 'Month Number' },
      { title: 'Mark as date table and relate', html: `<p><b>Table tools › Mark as date table</b>, choose the <b>Date</b> column (it must be unique, contiguous and without blanks). Then in Model view relate <b>Sales[OrderDate]</b> → <b>Date[Date]</b>.</p>${tip('Mark as date table so time intelligence works reliably and auto date/time is replaced by your own calendar. A date table must have one row per day with no gaps, covering full years.')}`, check: () => !!tbl('Date')?.dateColumn && !!rel('Sales', 'Date') },
    ],
    quiz: [
      { q: 'Month names in a chart sort Apr, Aug, Dec, Feb… How do you fix it?', options: ['Rename the months', 'Set Sort by column on Month to Month Number', 'Use FORMAT with "mm"', 'Change the visual\'s sort to ascending'], answer: 1, why: 'Sort by column sorts a text column by another column\'s values (one value per month name).' },
      { q: 'Which is a requirement to mark a table as a date table?', options: ['It must contain a Year column', 'The date column must be unique, contiguous and have no blanks', 'It must be created in Power Query', 'It must be related to every fact table'], answer: 1, why: 'Power BI validates that the date column contains unique, contiguous dates with no blanks.' },
    ],
  },
  {
    id: 'roleplay', area: 'Model the data', title: 'Role-playing dates with USERELATIONSHIP', minutes: 8,
    summary: 'Use an inactive Ship Date relationship in a measure, alongside the active Order Date relationship.',
    setup: () => loadScenario('Role-playing dimension', starScenario({ visuals: [{ type: 'table', x: 20, y: 20, w: 520, h: 360, wells: { columns: [{ table: 'Date', column: 'Year Month' }, { table: 'Sales', measure: 'Total Sales' }] } }] })),
    steps: [
      { title: 'Spot the inactive relationship', html: `<p>Open <b>Model view</b>. Sales has two relationships to Date: <b>OrderDate</b> (solid, active) and <b>ShipDate</b> (dashed, inactive). Only one active path may exist between two tables.</p>`, check: () => store.ui.view === 'model' },
      { title: 'Write the measure', html: `<p>Create a <b>New measure</b>:</p><pre>Sales by Ship Date =\nCALCULATE(\n    [Total Sales],\n    USERELATIONSHIP(Sales[ShipDate], 'Date'[Date])\n)</pre>`, check: () => !!measure(/USERELATIONSHIP/i) },
      { title: 'Compare', html: `<p>Add <b>Sales by Ship Date</b> to the table visual. Month by month the two measures differ, because orders ship a few days after they're placed. Grand totals match.</p>${tip('A "role-playing dimension" is one Date table used for several roles (order, ship, due). Keep one relationship active and activate the others inside measures with USERELATIONSHIP, or duplicate the Date table if users need separate slicers.')}`, check: () => pageVisuals().some(v => Object.values(v.wells).flat().some(f => /USERELATIONSHIP/i.test(store.project.model.measures.find(m => m.name === f.measure)?.expression ?? ''))) },
    ],
    quiz: [
      { q: 'Sales has OrderDate and ShipDate, both related to Date. ShipDate is inactive. How do you calculate sales by ship date?', options: ['Make both active', 'CALCULATE([Sales], USERELATIONSHIP(Sales[ShipDate], Date[Date]))', 'Use CROSSFILTER', 'Use RELATED(Date[Date])'], answer: 1, why: 'USERELATIONSHIP activates the inactive relationship for that calculation only.' },
    ],
  },
  {
    id: 'calccol', area: 'Model the data', title: 'Calculated columns vs measures, RELATED and row context', minutes: 10,
    summary: 'Compute a value per row with a calculated column and an aggregate with a measure, and see where each belongs.',
    setup: () => loadScenario('Columns vs measures', starScenario({ measures: [], view: 'table', visuals: [{ type: 'matrix', x: 20, y: 20, w: 600, h: 380, wells: { rows: [{ table: 'Product', column: 'Category' }], values: [] } }] })),
    steps: [
      { title: 'A calculated column', html: `<p>In <b>Table view</b> select the <b>Sales</b> table and choose <b>New column</b>:</p><pre>Cost = Sales[OrderQuantity] * RELATED(Product[Standard Cost])</pre><p>It's computed once per row at refresh, in <b>row context</b>. RELATED follows the many-to-one relationship to read the product's cost.</p>`, check: () => !!tbl('Sales')?.columns.some(c => c.expression && /RELATED/i.test(c.expression)) },
      { title: 'A measure', html: `<p>Choose <b>New measure</b>:</p><pre>Total Sales = SUM(Sales[SalesAmount])</pre><p>A measure is evaluated at query time in the <b>filter context</b> of each cell of a visual. It doesn't store values.</p>`, check: () => !!measure(/SUM\(\s*Sales\[SalesAmount\]\s*\)/i) },
      { title: 'Iterator measure', html: `<p>Instead of storing Cost per row, you can compute it on the fly:</p><pre>Total Cost = SUMX(Sales, Sales[OrderQuantity] * RELATED(Product[Standard Cost]))</pre><p>SUMX iterates the rows of Sales visible in the filter context, creating a row context for each.</p>`, check: () => !!measure(/SUMX\(\s*Sales/i) },
      { title: 'See the error a measure can\'t avoid', html: `<p>Try a measure <code>Bad = Sales[SalesAmount]</code>. The sandbox reports <i>A single value for column … cannot be determined</i>: a measure has no row context, so a naked column needs an aggregation.</p>${tip('Use a calculated column when you need to filter/slice/group by the result or for row-level logic at refresh time. Use measures for aggregations that respond to filters. Columns increase model size; measures don\'t.')}`, check: () => true },
    ],
    quiz: [
      { q: 'You need to slice a report by a customer "Age band" derived from BirthDate. Measure or calculated column?', options: ['Measure', 'Calculated column (or Power Query column)', 'Either works in a slicer', 'Quick measure'], answer: 1, why: 'Slicers, axes and filters need columns. Measures can\'t be placed on a slicer.' },
      { q: 'Which function lets a calculated column in Sales read a value from the related Product table?', options: ['RELATEDTABLE', 'LOOKUP', 'RELATED', 'USERELATIONSHIP'], answer: 2, why: 'RELATED follows a many-to-one relationship from the many side to the one side. RELATEDTABLE goes the other way, returning a table.' },
    ],
  },
  {
    id: 'calculate', area: 'Model the data', title: 'CALCULATE and filter context: ALL, REMOVEFILTERS, ALLEXCEPT', minutes: 12,
    summary: 'Write % of total, filtered measures and ratios, and learn how CALCULATE adds, overrides and removes filters.',
    setup: () => loadScenario('CALCULATE', starScenario({ visuals: [{ type: 'matrix', x: 20, y: 20, w: 760, h: 420, wells: { rows: [{ table: 'Product', column: 'Category' }, { table: 'Product', column: 'Subcategory' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } }, { type: 'slicer', x: 800, y: 20, w: 240, h: 240, wells: { field: [{ table: 'Store', column: 'Region' }] } }] })),
    steps: [
      { title: 'Add a filter', html: `<p>New measure:</p><pre>Bike Sales = CALCULATE([Total Sales], Product[Category] = "Bikes")</pre><p>Add it to the matrix. On the Accessories row it still shows the Bikes total: the filter argument <b>overrides</b> the existing filter on Product[Category].</p>`, check: () => !!measure(/CALCULATE\(.*Category\]\s*=\s*"Bikes"/is) },
      { title: 'Percent of grand total', html: `<pre>% of All Sales =\nDIVIDE([Total Sales], CALCULATE([Total Sales], ALL(Product)))</pre><p>Format it as a percentage (Measure tools › %). Every row is a share of all products.</p>`, check: () => !!measure(/DIVIDE\(.*ALL\(\s*'?Product'?\s*\)/is) || !!measure(/REMOVEFILTERS\(\s*'?Product/i) },
      { title: 'Percent of category (ALLEXCEPT)', html: `<pre>% of Category =\nDIVIDE([Total Sales], CALCULATE([Total Sales], ALLEXCEPT(Product, Product[Category])))</pre><p>Subcategories now add up to 100% within each category.</p>`, check: () => !!measure(/ALLEXCEPT/i) },
      { title: 'Respect the slicer (ALLSELECTED)', html: `<p>Select a Region in the slicer. <b>% of All Sales</b> uses ALL(Product), which keeps the Region filter. Try <code>ALLSELECTED(Product)</code> to divide by the total the user currently sees, or <code>REMOVEFILTERS()</code> to ignore every filter.</p>${tip('CALCULATE: (1) evaluates filter arguments, (2) applies context transition if there\'s a row context, (3) applies modifiers like ALL/REMOVEFILTERS/USERELATIONSHIP, (4) applies the filters (overriding filters on the same columns unless wrapped in KEEPFILTERS). DIVIDE handles division by zero by returning BLANK.')}`, check: () => !!measure(/ALLSELECTED/i) },
    ],
    quiz: [
      { q: 'Which expression returns total sales ignoring any filter on the Product table?', options: ['CALCULATE([Sales], VALUES(Product))', 'CALCULATE([Sales], ALL(Product))', 'SUMX(Product, [Sales])', 'FILTER(Product, TRUE())'], answer: 1, why: 'ALL(Product) (or REMOVEFILTERS(Product)) removes filters from the Product table inside CALCULATE.' },
      { q: 'You want "% of category total" for subcategories in a matrix. Which modifier?', options: ['ALL(Product)', 'ALLEXCEPT(Product, Product[Category])', 'KEEPFILTERS(Product[Category])', 'ALLSELECTED()'], answer: 1, why: 'ALLEXCEPT removes all Product filters except the one on Category, so the denominator is the category total.' },
      { q: 'Why use DIVIDE([A], [B]) instead of [A] / [B]?', options: ['It\'s faster in every case', 'It returns BLANK (or an alternate result) when B is 0 or blank instead of an error/infinity', 'It rounds the result', 'It ignores filters'], answer: 1, why: 'DIVIDE safely handles divide-by-zero and accepts an optional alternate result.' },
    ],
  },
  {
    id: 'timeintel', area: 'Model the data', title: 'Time intelligence: YTD, prior year, YoY %', minutes: 12,
    summary: 'Use TOTALYTD, SAMEPERIODLASTYEAR, DATEADD and DATESINPERIOD with a marked date table.',
    setup: () => loadScenario('Time intelligence', starScenario({ visuals: [{ type: 'matrix', x: 20, y: 20, w: 820, h: 460, wells: { rows: [{ table: 'Date', column: 'Year' }, { table: 'Date', column: 'Month' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } }] })),
    steps: [
      { title: 'Year to date', html: `<pre>Sales YTD = TOTALYTD([Total Sales], 'Date'[Date])</pre><p>Add it to the matrix and expand a year: the value accumulates month by month and resets in January. For a fiscal year ending June 30 use <code>TOTALYTD([Total Sales], 'Date'[Date], "6/30")</code>.</p>`, check: () => !!measure(/TOTALYTD|DATESYTD/i) },
      { title: 'Same period last year', html: `<pre>Sales PY = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Date'[Date]))</pre><p>2023 is blank (no 2022 data). <code>DATEADD('Date'[Date], -1, YEAR)</code> gives the same result and also works with MONTH, QUARTER or DAY.</p>`, check: () => !!measure(/SAMEPERIODLASTYEAR|DATEADD\(.*-1,\s*YEAR/is) },
      { title: 'Year over year %', html: `<pre>Sales YoY % =\nVAR PY = [Sales PY]\nRETURN DIVIDE([Total Sales] - PY, PY)</pre><p>Variables (VAR … RETURN) make measures readable and evaluate each expression once.</p>`, check: () => !!measure(/VAR[\s\S]*RETURN[\s\S]*DIVIDE/i) },
      { title: 'Rolling 3 months', html: `<pre>Sales Rolling 3M =\nCALCULATE([Total Sales], DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -3, MONTH))</pre>${tip('Time intelligence functions need a contiguous date column, ideally on a table marked as a date table and related to the fact. Without a proper Date table, functions like SAMEPERIODLASTYEAR return wrong or blank results.')}`, check: () => !!measure(/DATESINPERIOD/i) },
    ],
    quiz: [
      { q: 'Which measure returns sales for the same period in the previous year?', options: ['CALCULATE([Sales], PREVIOUSYEAR(Date[Date]))', 'CALCULATE([Sales], SAMEPERIODLASTYEAR(Date[Date]))', 'TOTALYTD([Sales], Date[Date])', 'CALCULATE([Sales], DATESYTD(Date[Date]))'], answer: 1, why: 'SAMEPERIODLASTYEAR shifts the current dates back one year (same as DATEADD -1 YEAR). PREVIOUSYEAR returns the entire previous year.' },
      { q: 'Your fiscal year ends on June 30. How do you write fiscal YTD?', options: ['TOTALYTD([Sales], Date[Date], "6/30")', 'TOTALYTD([Sales], Date[Date], 6)', 'DATESYTD(Date[Date]) + 6', 'TOTALQTD([Sales], Date[Date])'], answer: 0, why: 'The optional year_end_date argument of TOTALYTD/DATESYTD sets the fiscal year end.' },
    ],
  },
  {
    id: 'iterators', area: 'Model the data', title: 'Iterators, RANKX and TOPN', minutes: 10,
    summary: 'Rank products by sales, find the top 5, and average per customer with X functions.',
    setup: () => loadScenario('Iterators', starScenario({ visuals: [{ type: 'table', x: 20, y: 20, w: 620, h: 480, wells: { columns: [{ table: 'Product', column: 'Product Name' }, { table: 'Sales', measure: 'Total Sales' }] } }] })),
    steps: [
      { title: 'RANKX', html: `<pre>Product Rank = RANKX(ALL(Product[Product Name]), [Total Sales])</pre><p>Add it to the table. ALL makes the rank compare against every product, not only the one in the current row. Try <code>RANKX(ALLSELECTED(Product[Product Name]), [Total Sales], , DESC, DENSE)</code>.</p>`, check: () => !!measure(/RANKX/i) },
      { title: 'TOPN', html: `<pre>Top 5 Products Sales =\nCALCULATE([Total Sales], TOPN(5, ALL(Product[Product Name]), [Total Sales]))</pre><p>Or use the Filters pane: drag Product Name to <b>Filters on this visual</b>, choose <b>Top N</b>, show Top 5 by Total Sales.</p>`, check: () => !!measure(/TOPN/i) || pageVisuals().some(v => v.filters.some(f => f.type === 'topn')) },
      { title: 'Average per customer', html: `<pre>Avg Sales per Customer = AVERAGEX(VALUES(Customer[CustomerKey]), [Total Sales])</pre><p>AVERAGEX iterates customers; referencing the measure triggers <b>context transition</b> so each customer's own sales are averaged.</p>${tip('SUM(col) aggregates a column; SUMX(table, expr) evaluates an expression row by row and sums it. Measures referenced inside an iterator are wrapped in an implicit CALCULATE, which turns the row context into a filter context (context transition).')}`, check: () => !!measure(/AVERAGEX/i) },
    ],
    quiz: [
      { q: 'A RANKX measure returns 1 for every product. Why?', options: ['RANKX needs a sorted table', 'The table argument is filtered to the current product; use ALL(Product[Name])', 'RANKX can\'t rank measures', 'The measure isn\'t formatted'], answer: 1, why: 'In each row the filter context contains only that product, so it ranks against itself. ALL/ALLSELECTED gives the full list.' },
    ],
  },
  {
    id: 'm2m', area: 'Model the data', title: 'Many-to-many and bidirectional filters', minutes: 8,
    summary: 'Model customers who share accounts with a bridge table, and see when Both direction is needed.',
    setup: () => loadScenario('Many-to-many', {
      files: false,
      queries: [
        { name: 'Account', code: T([['AccountID', 'Int64.Type'], ['Account', 'text']], [[1, 'Joint savings'], [2, 'Business'], [3, 'Personal']]) },
        { name: 'Customer', code: T([['CustomerID', 'Int64.Type'], ['Customer', 'text']], [[10, 'Ana'], [11, 'Ben'], [12, 'Chloe']]) },
        { name: 'AccountCustomer', code: T([['AccountID', 'Int64.Type'], ['CustomerID', 'Int64.Type']], [[1, 10], [1, 11], [2, 11], [3, 12]]) },
        { name: 'Transactions', code: T([['TxID', 'Int64.Type'], ['AccountID', 'Int64.Type'], ['Amount', 'number']], [[1, 1, 100], [2, 1, 50], [3, 2, 300], [4, 3, 40], [5, 3, 60]]) },
      ],
      relationships: [
        { fromTable: 'Transactions', fromColumn: 'AccountID', toTable: 'Account', toColumn: 'AccountID', cardinality: 'many-one', crossFilter: 'single', active: true },
        { fromTable: 'AccountCustomer', fromColumn: 'AccountID', toTable: 'Account', toColumn: 'AccountID', cardinality: 'many-one', crossFilter: 'single', active: true },
        { fromTable: 'AccountCustomer', fromColumn: 'CustomerID', toTable: 'Customer', toColumn: 'CustomerID', cardinality: 'many-one', crossFilter: 'single', active: true },
      ],
      measures: [{ name: 'Total Amount', table: 'Transactions', expression: 'SUM(Transactions[Amount])' }],
      visuals: [{ type: 'table', x: 20, y: 20, w: 420, h: 260, wells: { columns: [{ table: 'Customer', column: 'Customer' }, { table: 'Transactions', measure: 'Total Amount' }] } }],
    }),
    steps: [
      { title: 'See the problem', html: `<p>The table shows <b>550</b> for every customer: the filter from Customer reaches the bridge table (AccountCustomer) but stops at Account because that relationship filters only from Account to the bridge.</p>` },
      { title: 'Turn on Both on the bridge', html: `<p>In Model view, edit <b>AccountCustomer → Account</b> and set <b>Cross-filter direction</b> to <b>Both</b>. Now Ana = 150, Ben = 450 (joint + business), Chloe = 100. The total stays 550 because shared accounts aren't double counted.</p>`, check: () => store.project.model.relationships.some(r => r.fromTable === 'AccountCustomer' && r.toTable === 'Account' && r.crossFilter === 'both') },
      { title: 'Alternative: CROSSFILTER in a measure', html: `<p>Set it back to Single and write instead:</p><pre>Amount (bridge) = CALCULATE([Total Amount], CROSSFILTER(AccountCustomer[AccountID], Account[AccountID], BOTH))</pre>${tip('Many-to-many between dimensions is modeled with a bridge (factless) table and a bidirectional filter on one relationship, or with the native *:* cardinality. Prefer enabling Both only where needed, or CROSSFILTER inside specific measures.')}`, check: () => !!measure(/CROSSFILTER/i) },
    ],
    quiz: [
      { q: 'Customers and Accounts have a many-to-many relationship through a bridge table. Customer filters don\'t reach Transactions. What fixes it?', options: ['Make every relationship inactive', 'Set the bridge→Account relationship to Both (or use CROSSFILTER)', 'Use RELATED', 'Merge the tables in Power Query'], answer: 1, why: 'The filter must flow from the bridge up to Account and then down to Transactions; Both direction (or CROSSFILTER) allows it.' },
    ],
  },
  {
    id: 'hier', area: 'Model the data', title: 'Hierarchies and parent-child (PATH)', minutes: 8,
    summary: 'Create a Category › Subcategory › Product hierarchy and flatten an employee hierarchy with PATH.',
    setup: () => loadScenario('Hierarchies', { queries: [{ name: 'Product', code: M.productClean }, { name: 'Employees', code: `let\n    Source = Csv.Document(File.Contents("${F('Employees.csv')}"),[Delimiter=",", Columns=7, Encoding=65001]),\n    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),\n    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"EmployeeKey", Int64.Type}, {"ManagerKey", Int64.Type}, {"HireDate", type date}})\nin\n    #"Changed Type"` }], view: 'table' }),
    steps: [
      { title: 'Create a hierarchy', html: `<p>In the Data pane right-click <b>Product › Category</b> › <b>Create hierarchy</b>. Right-click <b>Subcategory</b> › <b>Add to hierarchy</b>, then <b>Product Name</b>. Put the hierarchy on a bar chart's axis and use the drill buttons on the visual header.</p>`, check: () => store.project.model.hierarchies.some(h => h.levels.length >= 2) },
      { title: 'Flatten a parent-child hierarchy', html: `<p>Select the <b>Employees</b> table and add columns:</p><pre>Path = PATH(Employees[EmployeeKey], Employees[ManagerKey])\nLevel 1 = LOOKUPVALUE(Employees[EmployeeName], Employees[EmployeeKey], PATHITEM(Employees[Path], 1, INTEGER))\nLevel 2 = LOOKUPVALUE(Employees[EmployeeName], Employees[EmployeeKey], PATHITEM(Employees[Path], 2, INTEGER))\nDepth = PATHLENGTH(Employees[Path])</pre>${tip('Power BI can\'t use a self-referencing (EmployeeKey/ManagerKey) hierarchy directly. PATH builds a delimited path, PATHITEM picks each level, and you then build a regular hierarchy from the level columns.')}`, check: () => !!tbl('Employees')?.columns.some(c => c.expression && /PATH\(/i.test(c.expression)) },
    ],
    quiz: [
      { q: 'Which DAX function returns the delimited list of IDs from the top of a parent-child hierarchy down to the current row?', options: ['PATHITEM', 'PATH', 'PATHCONTAINS', 'LOOKUPVALUE'], answer: 1, why: 'PATH(id, parentId) returns e.g. "1|2|6|8". PATHITEM extracts a level, PATHLENGTH counts levels.' },
    ],
  },
  {
    id: 'perf', area: 'Model the data', title: 'Optimize the model and use DAX query view', minutes: 8,
    summary: 'Find slow visuals with Performance analyzer, reduce cardinality, and test measures in DAX query view.',
    setup: () => loadScenario('Optimize', starScenario({ visuals: [{ type: 'table', x: 20, y: 20, w: 700, h: 420, wells: { columns: [{ table: 'Sales', column: 'SalesOrderNumber' }, { table: 'Customer', column: 'Customer Name' }, { table: 'Sales', measure: 'Total Sales' }] } }] })),
    steps: [
      { title: 'Performance analyzer', html: `<p><b>View › Performance analyzer</b> (or Optimize ribbon), then <b>Refresh visuals</b>. Each visual's DAX query time appears. A table grouped by order number is slow because it has thousands of rows.</p>`, check: () => store.ui.panes.perf },
      { title: 'DAX query view', html: `<p>Open the <b>DAX query view</b> (fourth icon on the left) and run:</p><pre>EVALUATE\nSUMMARIZECOLUMNS(\n    'Date'[Year],\n    "Sales", [Total Sales],\n    "Margin", [Margin %]\n)\nORDER BY 'Date'[Year]</pre><p>You can also <code>DEFINE MEASURE Sales[Test] = …</code> to try a measure without adding it to the model.</p>`, check: () => !!store.ui.daxResult && !store.ui.daxResult.error },
      { title: 'Reduce model size', html: `<p>Good practices the exam tests:</p><ul><li>Remove columns you don't need (Power Query › Remove Columns) and filter rows (e.g. last 3 years).</li><li>Lower cardinality: split date-time into date and time, round decimals, avoid high-precision keys.</li><li>Disable <b>Auto date/time</b> (File › Options) when you have a Date table.</li><li>Prefer measures over calculated columns; use integer surrogate keys.</li><li>Aggregate (Group By) when detail isn't required, or use DirectQuery/composite models for huge facts.</li></ul>`, check: () => true },
    ],
    quiz: [
      { q: 'Which change most reduces the size of an Import model?', options: ['Adding more measures', 'Removing unused columns, especially high-cardinality ones', 'Turning on bidirectional relationships', 'Using more calculated columns'], answer: 1, why: 'VertiPaq compresses by column; removing high-cardinality columns (GUIDs, timestamps, free text) saves the most memory.' },
    ],
  },

  // ======================= VISUALIZE AND ANALYZE =======================
  {
    id: 'visuals', area: 'Visualize and analyze the data', title: 'Build and format visuals, conditional formatting', minutes: 10,
    summary: 'Create column, line, card and matrix visuals, change visual types, and add data bars and color scales.',
    setup: () => loadScenario('Visuals', starScenario({})),
    steps: [
      { title: 'Create a chart from the Data pane', html: `<p>Tick <b>Total Sales</b> in the Data pane: a column chart appears. Then tick <b>Product › Category</b>; it goes to the X-axis. With the chart selected, click the <b>Stacked bar</b> icon in the Visualizations pane to convert it.</p>`, check: () => pageVisuals().some(v => (v.wells.axis ?? []).length && (v.wells.values ?? []).length) },
      { title: 'A matrix with conditional formatting', html: `<p>Add a <b>Matrix</b>: Rows = Product Category, Columns = Date Year, Values = Total Sales. On <b>Format visual › Cell elements</b>, turn on <b>Background color</b> and <b>Data bars</b> for Total Sales.</p>`, check: () => pageVisuals().some(v => v.type === 'matrix' && Object.keys(v.format?.cf ?? {}).length) },
      { title: 'A card and a line chart', html: `<p>Add a <b>Card</b> with <b>Margin %</b>, and a <b>Line chart</b> with Date › Date on the X-axis and Total Sales. The axis uses the date hierarchy: use the visual header's drill buttons (↓ and ⇊) to move between Year, Quarter, Month and Day.</p>${tip('Choose visuals by question: compare categories → bar/column; trend over time → line/area; part-to-whole → stacked/100% or (few categories) donut; relationship between two measures → scatter; single number → card/KPI; progress to target → gauge/KPI.')}`, check: () => pageVisuals().some(v => v.type === 'card') && pageVisuals().some(v => v.type === 'line') },
    ],
    quiz: [
      { q: 'You need to show how Sales and Profit relate across 30 products. Which visual?', options: ['Pie chart', 'Scatter chart', 'Card', 'Ribbon chart'], answer: 1, why: 'A scatter chart plots two measures against each other for each item (with optional size and legend).' },
      { q: 'Which visual shows a value, a trend axis and a goal with a green/red indicator?', options: ['Gauge', 'KPI', 'Multi-row card', 'Waterfall'], answer: 1, why: 'The KPI visual uses Value, Trend axis and Target to color the indicator.' },
    ],
  },
  {
    id: 'filters', area: 'Visualize and analyze the data', title: 'Slicers and the Filters pane: visual, page, report', minutes: 10,
    summary: 'Use slicers, basic/advanced/Top N/relative date filters at the right level, and lock or hide filters.',
    setup: () => loadScenario('Filters', starScenario({ pages: [
      { name: 'Sales', visuals: [{ type: 'clusteredBar', x: 20, y: 20, w: 560, h: 420, wells: { axis: [{ table: 'Product', column: 'Product Name' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } }, { type: 'card', x: 600, y: 20, w: 260, h: 120, wells: { values: [{ table: 'Sales', measure: 'Total Sales' }] } }] },
      { name: 'Customers', visuals: [{ type: 'table', x: 20, y: 20, w: 600, h: 420, wells: { columns: [{ table: 'Customer', column: 'Country' }, { table: 'Sales', measure: 'Total Sales' }] } }] },
    ] })),
    steps: [
      { title: 'Add a slicer', html: `<p>Add a <b>Slicer</b> with <b>Store › Region</b>. In Format › Slicer settings choose <b>Single select</b> or the <b>Tile</b> style. Selecting a region filters every visual on the page.</p>`, check: () => pageVisuals().some(v => v.type === 'slicer') },
      { title: 'Top N visual filter', html: `<p>Select the bar chart. In the <b>Filters</b> pane expand <b>Product Name</b> under <i>Filters on this visual</i>, set <b>Filter type</b> to <b>Top N</b>, Top <b>10</b>, and drag <b>Total Sales</b> into <b>By value</b>.</p>`, check: () => pageVisuals().some(v => v.filters.some(f => f.type === 'topn' && (f as any).by)) },
      { title: 'Page and report filters', html: `<p>Drag <b>Product › Category</b> to <b>Filters on this page</b> and keep only Bikes: the card changes, the Customers page doesn't. Drag <b>Customer › Segment</b> to <b>Filters on all pages</b> and pick Consumer: both pages change.</p>`, check: () => store.project.report.pages.some(p => p.filters.some(f => f.type === 'basic' && f.values.length)) && store.project.report.reportFilters.some(f => f.type === 'basic' && f.values.length) },
      { title: 'Lock and hide', html: `<p>Use the lock icon to stop report readers changing a filter, and the eye icon to hide it from them.</p>${tip('Scope: visual-level filters affect one visual (and can use measures, e.g. "Total Sales greater than 1000"); page-level filters one page; report-level all pages. Slicers are visuals on the canvas and can be synced across pages. Top N is a visual-level filter type.')}`, check: () => [...store.project.report.reportFilters, ...store.project.report.pages.flatMap(p => p.filters)].some(f => f.locked || f.hidden) },
    ],
    quiz: [
      { q: 'You want a filter that shows only products where Total Sales > 1,000 in one chart. Where?', options: ['Report-level filter on Product Name', 'Visual-level filter using the Total Sales measure', 'Page-level filter on Total Sales', 'A slicer on Total Sales'], answer: 1, why: 'Measures can only be used as visual-level filters (Advanced filtering on the aggregated value).' },
      { q: 'A filter should apply to every page and readers must not change it. What do you do?', options: ['Add it to Filters on all pages and lock it', 'Add a slicer to every page', 'Use a page-level filter on each page', 'Hide the column'], answer: 0, why: 'Report-level filters apply everywhere; locking prevents changes, hiding removes it from the readers\' Filters pane.' },
    ],
  },
  {
    id: 'interact', area: 'Visualize and analyze the data', title: 'Interactions, drill down and drill through', minutes: 10,
    summary: 'Cross-filter vs cross-highlight, edit interactions, drill a hierarchy, and build a drill-through page.',
    setup: () => loadScenario('Interactions', starScenario({ pages: [
      { name: 'Overview', visuals: [
        { type: 'clusteredColumn', x: 20, y: 20, w: 560, h: 320, wells: { axis: [{ table: 'Product', column: 'Category' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } },
        { type: 'donut', x: 600, y: 20, w: 360, h: 320, wells: { axis: [{ table: 'Customer', column: 'Segment' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } },
        { type: 'line', x: 20, y: 360, w: 940, h: 300, wells: { axis: [{ table: 'Sales', column: 'OrderDate' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } },
      ] },
      { name: 'Product details', visuals: [{ type: 'table', x: 20, y: 60, w: 700, h: 420, wells: { columns: [{ table: 'Product', column: 'Product Name' }, { table: 'Product', column: 'Color' }, { table: 'Sales', measure: 'Total Sales' }, { table: 'Sales', measure: 'Margin %' }] } }] },
    ] })),
    steps: [
      { title: 'Cross-highlight and cross-filter', html: `<p>Click the <b>Bikes</b> column. The donut <b>highlights</b> the Bikes portion (faded remainder) and the line chart is <b>filtered</b>. Click it again to clear.</p>` },
      { title: 'Edit interactions', html: `<p>Select the column chart, then <b>Format › Edit interactions</b>. Small icons appear on the other visuals: choose <b>Filter</b> for the donut and <b>None</b> for the line chart. Click Bikes again to see the difference.</p>`, check: () => Object.keys(store.project.report.pages[0].interactions ?? {}).length > 0 },
      { title: 'Drill down a date hierarchy', html: `<p>The line chart's axis is a date column, so Power BI uses Year › Quarter › Month › Day. On its header use <b>Go to the next level</b> (⇊) or turn on <b>Drill down</b> (↓ in a circle) and click a point to drill into that year.</p>`, check: () => store.project.report.pages[0].visuals.some(v => (v.drill?.level ?? 0) > 0) },
      { title: 'Drill through', html: `<p>Go to the <b>Product details</b> page, and with nothing selected drag <b>Product › Category</b> into <b>Drill through</b> in the Visualizations pane. A Back button appears. Return to Overview, right-click the Bikes column › <b>Drill through › Product details</b>.</p>${tip('Drill down navigates a hierarchy within one visual. Drill through jumps to another page filtered by the clicked value (the target page has the field in its Drill through well and gets a Back button). Edit interactions sets Filter/Highlight/None per pair of visuals.')}`, check: () => store.project.report.pages.some(p => p.drillthrough?.length) },
    ],
    quiz: [
      { q: 'When you click a bar, another chart should not change at all. What do you configure?', options: ['Drill through', 'Edit interactions › None on that chart', 'A report-level filter', 'Sync slicers'], answer: 1, why: 'Edit interactions lets you set Filter, Highlight or None for each target visual.' },
      { q: 'Users must right-click a product on any page and open a detail page for that product. Which feature?', options: ['Bookmarks', 'Drill through', 'Drill down', 'Tooltips'], answer: 1, why: 'Add the product field to the target page\'s Drill through well.' },
    ],
  },
  {
    id: 'bookmarks', area: 'Visualize and analyze the data', title: 'Bookmarks, buttons and the Selection pane', minutes: 8,
    summary: 'Toggle between a chart and a table with bookmarks, buttons and visibility in the Selection pane.',
    setup: () => loadScenario('Bookmarks', starScenario({ visuals: [
      { type: 'clusteredColumn', x: 20, y: 70, w: 640, h: 380, wells: { axis: [{ table: 'Product', column: 'Category' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } },
      { type: 'table', x: 20, y: 70, w: 640, h: 380, hidden: true, wells: { columns: [{ table: 'Product', column: 'Category' }, { table: 'Sales', measure: 'Total Sales' }, { table: 'Sales', measure: 'Profit' }] } },
    ] })),
    steps: [
      { title: 'Selection pane', html: `<p><b>View › Selection</b>. Two visuals sit on top of each other; the table is hidden (eye icon).</p>`, check: () => store.ui.panes.selection },
      { title: 'Two bookmarks', html: `<p>Open <b>View › Bookmarks</b>. With the chart visible select <b>Add</b> and rename it <code>Chart view</code>. Hide the chart and show the table, then <b>Add</b> <code>Table view</code>.</p>`, check: () => store.project.report.bookmarks.length >= 2 },
      { title: 'Buttons', html: `<p><b>Insert › Buttons › Bookmark</b>, set its action to the <i>Table view</i> bookmark (Format pane › Button › Action). Add another for <i>Chart view</i>. Ctrl+click the buttons to test.</p>${tip('Bookmarks capture filters, slicers, sort, drill and visibility for a page. Clear "Data" on a bookmark when it should only change visibility (so it doesn\'t reset slicers). Buttons can run bookmark, page navigation, back, drill through or Q&A actions.')}`, check: () => pageVisuals().some(v => v.type === 'button' && v.action?.type === 'bookmark' && v.action.target) },
    ],
    quiz: [
      { q: 'A bookmark should toggle visuals without resetting slicer selections. Which bookmark option do you clear?', options: ['Display', 'Data', 'Current page', 'All visuals'], answer: 1, why: 'The Data option captures filters and slicers. Turn it off so the bookmark only applies visibility (Display).' },
    ],
  },
  {
    id: 'ai', area: 'Visualize and analyze the data', title: 'AI visuals and the Analytics pane', minutes: 8,
    summary: 'Explore with a decomposition tree, key influencers and Q&A, and add trend and average lines.',
    setup: () => loadScenario('AI visuals', starScenario({ visuals: [{ type: 'line', x: 20, y: 20, w: 620, h: 300, wells: { axis: [{ table: 'Date', column: 'Year Month' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } }] })),
    steps: [
      { title: 'Analytics pane', html: `<p>Select the line chart, open the <b>Analytics</b> tab (third icon in Visualizations) and turn on <b>Trend line</b> and <b>Average line</b>.</p>`, check: () => pageVisuals().some(v => v.format?.analytics?.trend || v.format?.analytics?.average) },
      { title: 'Decomposition tree', html: `<p><b>Insert › Decomposition tree</b>. Analyze = <b>Total Sales</b>; Explain by = Category, Region, Segment. Click <b>+</b> (Expand by) and pick a field, or let <b>High value</b> choose the split that leads to the highest value.</p>`, check: () => pageVisuals().some(v => v.type === 'decompositionTree' && (v.wells.explain ?? []).length) },
      { title: 'Q&A', html: `<p><b>Insert › Q&amp;A</b> and type <code>total sales by category</code>, then <code>margin % by region as pie</code>.</p>${tip('Key influencers ranks factors that drive a metric up or down; decomposition tree drills a measure across dimensions (AI splits pick the highest/lowest); Q&A answers natural-language questions and can be tuned with synonyms in Q&A setup.')}`, check: () => pageVisuals().some(v => v.type === 'qna') },
    ],
    quiz: [
      { q: 'Which visual helps find which factors most affect whether customer satisfaction is "Low"?', options: ['Decomposition tree', 'Key influencers', 'Q&A', 'Ribbon chart'], answer: 1, why: 'Key influencers analyzes what drives a metric or category value.' },
    ],
  },
  {
    id: 'whatif', area: 'Visualize and analyze the data', title: 'What-if parameters and dynamic measures', minutes: 8,
    summary: 'Model a discount scenario with a numeric range parameter, and switch measures with SWITCH.',
    setup: () => loadScenario('What-if', starScenario({ visuals: [{ type: 'clusteredColumn', x: 20, y: 20, w: 600, h: 360, wells: { axis: [{ table: 'Product', column: 'Category' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } }] })),
    steps: [
      { title: 'Create the parameter', html: `<p><b>Modeling › New parameter › Numeric range</b>: name <code>Discount</code>, 0 to 0.5, increment 0.05, default 0.1, add slicer. Power BI creates a table (GENERATESERIES) and a measure <b>[Discount Value]</b> (SELECTEDVALUE).</p>`, check: () => !!tbl('Discount') && !!measure(/SELECTEDVALUE\('?Discount/i) },
      { title: 'Use it', html: `<pre>Sales after Discount = [Total Sales] * (1 - [Discount Value])</pre><p>Add it to the chart and move the slicer.</p>`, check: () => !!measure(/\[Discount Value\]/i) },
      { title: 'Dynamic measure with SWITCH', html: `<p><b>Enter data</b>: a one-column table <code>Metric</code> with rows Sales, Profit, Margin. Add a slicer on it, and a measure:</p><pre>Selected Metric =\nSWITCH(SELECTEDVALUE(Metric[Column1]),\n    "Sales", [Total Sales],\n    "Profit", [Profit],\n    "Margin", [Margin %],\n    [Total Sales])</pre>${tip('A what-if parameter is a disconnected table plus a SELECTEDVALUE measure. SELECTEDVALUE(col, default) returns the single selected value or the default when zero or many are selected.')}`, check: () => !!measure(/SWITCH\s*\(\s*SELECTEDVALUE/i) },
    ],
    quiz: [
      { q: 'What does SELECTEDVALUE(Table[Col], 0) return when two values are selected?', options: ['The first value', '0', 'An error', 'BLANK always'], answer: 1, why: 'With anything other than exactly one value in the filter context it returns the alternate result.' },
    ],
  },

  // ======================= MANAGE AND SECURE =======================
  {
    id: 'rls', area: 'Manage and secure Power BI', title: 'Row-level security: static and dynamic', minutes: 12,
    summary: 'Create a static Region role and a dynamic role using USERPRINCIPALNAME, then test with View as.',
    setup: () => loadScenario('Row-level security', starScenario({ visuals: [
      { type: 'clusteredBar', x: 20, y: 20, w: 560, h: 340, wells: { axis: [{ table: 'Store', column: 'StoreName' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } },
      { type: 'card', x: 600, y: 20, w: 260, h: 120, wells: { values: [{ table: 'Sales', measure: 'Total Sales' }] } },
    ] })),
    steps: [
      { title: 'Static role', html: `<p><b>Modeling › Manage roles › New</b>. Name it <code>Europe</code>, select the <b>Store</b> table and enter <code>Store[Region] = "Europe"</code>. Validate, then Save.</p>`, check: () => store.project.model.roles.some(r => Object.values(r.filters).some(f => /Region\]\s*=\s*"/.test(f))) },
      { title: 'Test with View as', html: `<p><b>Modeling › View as</b>, tick <b>Europe</b>. The status bar shows "Now viewing as". Only London and Berlin appear, and the card total drops. The Store filter flows to Sales through the relationship.</p>`, check: () => !!store.ui.viewAs?.roles.length },
      { title: 'Dynamic role', html: `<p>Create role <code>Store manager</code> on <b>Store</b>:</p><pre>Store[ManagerEmail] = USERPRINCIPALNAME()</pre><p>View as <b>Other user</b> <code>brooke@contoso.com</code> plus the <b>Store manager</b> role. Brooke sees only her stores.</p>${tip('Static RLS hard-codes values (one role per region). Dynamic RLS uses USERPRINCIPALNAME() (the user\'s email/UPN) against a column or a security table, so one role serves everyone. Roles are defined in Desktop; members are assigned in the Power BI service. RLS applies to Viewers, not to workspace Admins/Members/Contributors.')}`, check: () => store.project.model.roles.some(r => Object.values(r.filters).some(f => /USERPRINCIPALNAME/i.test(f))) },
    ],
    quiz: [
      { q: 'One role should let each salesperson see only their own region, based on their sign-in. Which DAX filter?', options: ['[Region] = "North"', '[Email] = USERPRINCIPALNAME()', 'ISFILTERED([Region])', 'USERELATIONSHIP([Email], [Region])'], answer: 1, why: 'USERPRINCIPALNAME() returns the signed-in user\'s UPN; comparing it to an email column gives dynamic RLS.' },
      { q: 'Where do you add users to a role?', options: ['In Power BI Desktop Manage roles', 'In the Power BI service, semantic model › Security', 'In Power Query', 'In the report\'s Filters pane'], answer: 1, why: 'Desktop defines roles and filters; members are assigned in the service.' },
      { q: 'A workspace Member says RLS doesn\'t restrict them. Why?', options: ['RLS is broken', 'RLS applies only to users with Viewer permission (or app/share consumers), not to Admin/Member/Contributor', 'They used Q&A', 'USERNAME() should be used'], answer: 1, why: 'Users who can edit content in the workspace bypass RLS.' },
    ],
  },
  {
    id: 'service', area: 'Manage and secure Power BI', title: 'Workspaces, apps, refresh and gateways (exam notes)', minutes: 6,
    summary: 'The Power BI service concepts the exam asks about, with a short self-check.',
    setup: async () => { /* no data needed */ },
    steps: [
      { title: 'Workspaces and roles', html: `<ul><li><b>My workspace</b>: personal; content can't be shared through an app.</li><li>Workspace roles: <b>Admin</b> (everything, including members), <b>Member</b> (publish, share, add Contributors/Viewers), <b>Contributor</b> (create and edit content, can't share), <b>Viewer</b> (read only; RLS applies).</li><li>Distribute to large audiences with an <b>app</b>; use <b>audiences</b> to show different content to different groups.</li></ul>` },
      { title: 'Refresh and gateways', html: `<ul><li>Import models need <b>scheduled refresh</b>: up to 8 per day on Pro/shared capacity, 48 on Premium/Fabric capacity.</li><li>On-premises sources (SQL Server, file shares) need an <b>on-premises data gateway</b>; cloud sources don't.</li><li><b>Incremental refresh</b> uses RangeStart/RangeEnd parameters to refresh only recent partitions.</li><li>DirectQuery and live connections don't need data refresh; tiles can use <b>automatic page refresh</b>.</li></ul>` },
      { title: 'Govern and share', html: `<ul><li><b>Endorsement</b>: Promoted (by owners) and Certified (by authorized reviewers).</li><li><b>Sensitivity labels</b> (Microsoft Purview) travel with exports.</li><li><b>Dashboards</b> pin tiles from reports; <b>alerts</b> work on card, KPI and gauge tiles; <b>subscriptions</b> email snapshots.</li><li><b>Deployment pipelines</b> move content Dev → Test → Prod, with rules to swap data sources/parameters.</li></ul>` },
    ],
    quiz: [
      { q: 'A user needs to edit reports in a workspace but must not share content or manage access. Which role?', options: ['Viewer', 'Contributor', 'Member', 'Admin'], answer: 1, why: 'Contributors can create, edit and publish content but can\'t share or manage permissions.' },
      { q: 'A semantic model imports data from an on-premises SQL Server and must refresh daily. What\'s required?', options: ['DirectQuery', 'An on-premises data gateway', 'Premium capacity', 'A dataflow'], answer: 1, why: 'Scheduled refresh of on-premises sources requires a gateway.' },
      { q: 'How many scheduled refreshes per day does a shared (Pro) capacity allow?', options: ['4', '8', '24', '48'], answer: 1, why: '8 per day on shared capacity; 48 on Premium/Fabric capacity.' },
    ],
  },
];

export const AREAS: Area[] = ['Prepare the data', 'Model the data', 'Visualize and analyze the data', 'Manage and secure Power BI'];

export { emptyCtx, dax, DATE_TABLE, loaded };
