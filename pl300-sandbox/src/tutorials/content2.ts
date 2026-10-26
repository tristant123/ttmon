// Labs for calculation groups, storage modes, privacy levels, shared semantic models, visual calculations,
// tooltip pages and sync slicers, analytics, mobile layout, and the Power BI service.
import { store } from '../store';
import { loadScenario, starScenario, M, OVERVIEW_PAGES, F } from './scenarios';
import type { Tutorial } from './content';
import { svc, item, access } from '../service/model';
import { ensureSeedContent } from '../service/seed';

const tip = (t: string) => `<div class="tip"><b>Exam tip</b>${t}</div>`;
const tables = () => store.project.model.tables;
const pages = () => store.project.report.pages;
const visuals = () => pages().flatMap(p => p.visuals);
const S = () => svc.get();
const myItems = () => S().items;

const SALES_SQL = `let
    Source = Sql.Database("localhost", "ContosoDW"),
    dbo_FactSales = Source{[Schema="dbo",Item="FactSales"]}[Data]
in
    dbo_FactSales`;
const PRODUCT_SQL = `let
    Source = Sql.Database("localhost", "ContosoDW"),
    dbo_DimProduct = Source{[Schema="dbo",Item="DimProduct"]}[Data]
in
    dbo_DimProduct`;

export const NEW_TUTORIALS: Tutorial[] = [
  // ---------------------------------------------------------------- Prepare
  {
    id: 'storage', area: 'Prepare the data', title: 'Import, DirectQuery, Dual and Direct Lake', minutes: 12,
    summary: 'Connect with DirectQuery, see which Power Query steps fold, build a composite model with Dual tables, and compare Direct Lake.',
    setup: () => loadScenario('Storage modes', { queries: [], view: 'report' }),
    steps: [
      { title: 'Connect with DirectQuery', html: `<p><b>Home › SQL Server</b>. Server <code>localhost</code>, database <code>ContosoDW</code>, choose <b>DirectQuery</b> as the data connectivity mode, then OK (accept the Windows credentials). Select <b>dbo.FactSales</b> and <b>dbo.DimProduct</b> and <b>Load</b>.</p><p>The status bar now says <b>Storage mode: DirectQuery</b>. In Model view the cards have a blue bar; Table view says the table "uses DirectQuery and cannot be shown".</p>`, check: () => tables().some(t => t.storageMode === 'DirectQuery') },
      { title: 'See query folding', html: `<p><b>Transform data</b>, select <b>dbo FactSales</b>. Filter <i>OrderQuantity</i> greater than 2 and remove a few columns. Each step shows a blue square: it <b>folds</b> to SQL. Right-click the last step › <b>View Native Query</b> to see the SELECT … WHERE.</p><p>Now <b>Add Column › Index Column</b>. The step shows an orange outline (not folding) and the banner says <i>This step results in a query that is not supported in DirectQuery mode</i>. Delete the Index step, then Close &amp; Apply.</p>${tip('DirectQuery only allows transformations that fold to the source. Index columns, transposing, and many text functions break folding. Query folding also matters for Import and incremental refresh: it pushes work to the source.')}`, check: () => store.project.queries.some(q => /Table\.SelectRows/.test(q.code) && /Sql\.Database/.test(q.code)) },
      { title: 'Composite model and Dual', html: `<p><b>Home › Sample data</b>… or simply <b>Enter data</b> a small Budget table (Category, Budget) in <b>Import</b> mode and relate it to <b>dbo DimProduct</b> on Category (many-to-many). Mixing Import and DirectQuery makes a <b>composite model</b> (status bar: <b>Mixed</b>).</p><p>Select <b>dbo DimProduct</b> in Model view › Properties › <b>Storage mode: Dual</b>. Dual tables act as Import or DirectQuery, whichever avoids a <i>limited relationship</i>. Note that Import can't be changed to DirectQuery, and changing DirectQuery to Import is irreversible.</p>`, check: () => tables().some(t => t.storageMode === 'Dual') || (tables().some(t => (t.storageMode ?? 'Import') === 'Import' && !t.expression) && tables().some(t => t.storageMode === 'DirectQuery')) },
      { title: 'Direct Lake', html: `<p><b>Get data › Lakehouses (OneLake catalog)</b> › <b>ContosoLakehouse</b> › choose <b>Direct Lake</b>, pick DimStore and Connect. Direct Lake tables (teal bar) read Delta tables in OneLake: no import refresh (only reframing), no Power Query steps, no calculated columns. Try <b>Transform data</b> on it to see the message.</p>${tip('Choose Import for best performance and full Power Query/DAX; DirectQuery when data must stay in the source or be current at query time (on-premises needs a standard gateway); Direct Lake for large Fabric lakehouse/warehouse data without scheduled refresh.')}`, check: () => tables().some(t => t.storageMode === 'DirectLake') },
    ],
    quiz: [
      { q: 'Which Power Query step can\'t be used on a DirectQuery table?', options: ['Filter rows', 'Remove columns', 'Add an index column', 'Change type'], answer: 2, why: 'An index column doesn\'t fold to SQL, so it isn\'t supported in DirectQuery.' },
      { q: 'In a composite model, a Product dimension relates to an Import Budget table and a DirectQuery Sales table. How should Product be stored?', options: ['Import', 'DirectQuery', 'Dual', 'Direct Lake'], answer: 2, why: 'Dual lets the table act as Import or DirectQuery so both relationships stay regular (not limited).' },
    ],
  },
  {
    id: 'privacy', area: 'Prepare the data', title: 'Data source settings, credentials and privacy levels', minutes: 10,
    summary: 'Combine a file with SQL Server, answer the privacy prompt, trigger Formula.Firewall, and use Change Source and Edit Permissions.',
    setup: () => loadScenario('Privacy levels', { privacyUnset: true, queries: [{ name: 'Sales', code: M.salesClean }, { name: 'Product', code: PRODUCT_SQL }], view: 'report', openPQ: 'Sales' }),
    steps: [
      { title: 'Merge two sources', html: `<p><b>Transform data</b>, select <b>Sales</b> (a CSV file). <b>Home › Merge Queries</b> with <b>Product</b> (SQL Server) on ProductKey. Power Query shows <b>Information is required about data privacy</b>. Select <b>Continue</b>.</p>`, check: () => store.project.queries.some(q => /NestedJoin/.test(q.code)) || (store.ui.pq?.queries ?? []).some(q => /NestedJoin/.test(q.code)) },
      { title: 'Set privacy levels', html: `<p>Set the CSV file to <b>Private</b> and SQL Server to <b>Organizational</b>, then Save. The merge now fails with <b>Formula.Firewall: … privacy levels which cannot be used together</b>: Private data can't be sent to another source (here it could be folded into the SQL query).</p><p>Open <b>Privacy levels</b> again and set the file to <b>Organizational</b>. The merge works.</p>${tip('Private: isolated from all other sources. Organizational: can combine with Organizational sources, not Public ones. Public: anything. "Ignore privacy levels" (Options › Privacy) can improve performance but may expose data.')}`, check: () => Object.values(store.project.dataSources ?? {}).filter(x => x.privacy && x.privacy !== 'None').length >= 2 },
      { title: 'Change Source and credentials', html: `<p>Close &amp; Apply. <b>Home › Transform data ▾ › Data source settings</b>. Select the SQL source › <b>Edit Permissions</b>: see the credential type and privacy level. Select <b>Clear Permissions</b>, then Refresh: the refresh fails with "Credentials are required". Use <b>Edit credentials</b> to fix it.</p><p>Select the CSV source › <b>Change Source…</b> to point every query that uses it at another file in one go.</p>${tip('Change Source updates all queries that use a source. If the path comes from a parameter, edit the parameter instead.')}`, check: () => Object.values(store.project.dataSources ?? {}).some(x => !!x.credential) },
    ],
    quiz: [
      { q: 'HR data in a SQL database must never be sent to a public web API during folding. Which privacy level should HR have?', options: ['None', 'Public', 'Organizational', 'Private'], answer: 3, why: 'Private isolates the source from every other source.' },
      { q: 'A query step uses File.Contents(PathQuery{0}[Path]) where PathQuery reads a SharePoint list. What error do you expect?', options: ['Expression.Error', 'Formula.Firewall: … references other queries or steps, so it may not directly access a data source', 'DataFormat.Error', 'No error'], answer: 1, why: 'A step that accesses a data source must not also use another query that accesses a source: rebuild the combination in separate queries.' },
    ],
  },
  {
    id: 'sharedmodel', area: 'Prepare the data', title: 'Connect to a shared semantic model', minutes: 8,
    summary: 'Build a thin report on a published, certified semantic model with a live connection, then make a composite model.',
    setup: async () => { await loadScenario('Thin report', { queries: [], view: 'report' }); await ensureSeedContent(); },
    steps: [
      { title: 'Live connection', html: `<p><b>Get data › Power BI semantic models</b> (or the OneLake catalog). The certified <b>Contoso Sales</b> model in Sales Analytics shows your permission: you need <b>Build</b>. Select it › <b>Connect</b>.</p><p>The status bar says <i>Connected live to the Power BI semantic model</i>. Transform data and New column are unavailable; Table view is empty.</p>`, check: () => !!(store.project as any).liveConnection },
      { title: 'Report measures', html: `<p>Create a measure <code>Avg Order = DIVIDE([Total Sales], [Order Count])</code>. Measures you add in a live-connected report are <b>report-level</b>: they live in the report, not the shared model.</p>`, check: () => store.project.model.measures.some(m => /Order Count/.test(m.expression)) },
      { title: 'Make changes to this model', html: `<p>Select <b>Make changes to this model</b> in the status bar. The connection becomes <b>DirectQuery for Power BI semantic models</b> and you can add your own tables (a <b>composite model</b>). The remote tables show as DirectQuery.</p>${tip('Live connection: no Power Query, no calculated columns; report measures allowed; needs Build. Composite (DirectQuery to the semantic model): add local data and relationships; RLS of the source model still applies.')}`, check: () => !!(store.project as any).liveConnection?.composite },
    ],
    quiz: [
      { q: 'Analysts must create reports from a certified semantic model without being able to change it. What do they need?', options: ['Contributor role', 'Build permission on the semantic model', 'Reshare permission on the report', 'Admin role'], answer: 1, why: 'Build lets people create content on the model (live connections, Analyze in Excel) without editing it.' },
      { q: 'In a live-connected report, which can you add?', options: ['A calculated column', 'A Power Query step', 'A report-level measure', 'A new table from Excel (without other changes)'], answer: 2, why: 'Live connections allow report measures; adding data needs Make changes to this model (composite).' },
    ],
  },
  // ---------------------------------------------------------------- Model
  {
    id: 'calcgroups', area: 'Model the data', title: 'Calculation groups', minutes: 10,
    summary: 'Create a Time Intelligence calculation group with Current, PY and YTD items that work with every measure.',
    setup: () => loadScenario('Calculation groups', starScenario({ view: 'model', visuals: [
      { type: 'matrix', x: 20, y: 20, w: 760, h: 360, wells: { rows: [{ table: 'Date', column: 'Year' }], values: [{ table: 'Sales', measure: 'Total Sales' }, { table: 'Sales', measure: 'Profit' }] } },
    ] })),
    steps: [
      { title: 'Create the group', html: `<p>In <b>Model view</b>, select <b>Home › Calculation group</b>. Power BI turns on <b>Discourage implicit measures</b> (calculation groups only work with explicit measures). Rename the table to <code>Time Intelligence</code>.</p>`, check: () => tables().some(t => t.calculationGroup) },
      { title: 'Add calculation items', html: `<p>The first item opens in the formula bar. Make three items (Data pane › Calculation items › right-click › New calculation item):</p><pre>Current = SELECTEDMEASURE()
PY = CALCULATE(SELECTEDMEASURE(), SAMEPERIODLASTYEAR('Date'[Date]))
YTD = CALCULATE(SELECTEDMEASURE(), DATESYTD('Date'[Date]))</pre>`, check: () => tables().some(t => (t.calculationGroup?.items.filter(i => /SELECTEDMEASURE/.test(i.expression)).length ?? 0) >= 3) },
      { title: 'Use it in a visual', html: `<p>Report view: put the calculation group's <b>Name</b> column on the matrix <b>Columns</b>. Both Total Sales and Profit are calculated for Current, PY and YTD. Try a slicer on Name too.</p><p>Optional: set a dynamic format string on an item in the Properties pane, e.g. a <code>YoY %</code> item with <code>"0.0%"</code>.</p>${tip('SELECTEDMEASURE() refers to the measure in the visual. Precedence decides the order when several calculation groups apply. Implicit measures are ignored, which is why the model property is turned on.')}`, check: () => visuals().some(v => Object.values(v.wells).flat().some(f => tables().find(t => t.name === f.table)?.calculationGroup)) },
    ],
    quiz: [
      { q: 'Which function lets one calculation item work for every measure?', options: ['SELECTEDVALUE', 'SELECTEDMEASURE', 'ISINSCOPE', 'VALUES'], answer: 1, why: 'SELECTEDMEASURE() is replaced by the measure being evaluated.' },
      { q: 'After adding a calculation group, a user can no longer drag a numeric column into Values. Why?', options: ['A bug', 'Discourage implicit measures was turned on, because calculation groups only apply to explicit measures', 'The column is hidden', 'RLS'], answer: 1, why: 'Creating a calculation group turns on Discourage implicit measures.' },
    ],
  },
  // ---------------------------------------------------------------- Visualize
  {
    id: 'viscalc', area: 'Visualize and analyze the data', title: 'Visual calculations', minutes: 8,
    summary: 'Add a running sum, percent of parent and versus-previous calculations that live in the visual, and hide helper fields.',
    setup: () => loadScenario('Visual calculations', starScenario({ visuals: [
      { type: 'matrix', x: 20, y: 20, w: 780, h: 400, wells: { rows: [{ table: 'Product', column: 'Category' }, { table: 'Product', column: 'Subcategory' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } },
      { type: 'line', x: 820, y: 20, w: 440, h: 300, wells: { axis: [{ table: 'Date', column: 'Year Month' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } },
    ] })),
    steps: [
      { title: 'Running sum', html: `<p>Select the matrix › <b>Home › New visual calculation</b>. Choose <b>Templates › Running sum</b> (<code>RUNNINGSUM([Total Sales])</code>) and commit. The visual matrix at the bottom shows how it's evaluated row by row.</p>`, check: () => visuals().some(v => Object.values(v.wells).flat().some(f => /RUNNINGSUM/i.test(f.calcExpr ?? ''))) },
      { title: 'Percent of parent', html: `<p>Add another: <code>Pct of parent = DIVIDE([Total Sales], COLLAPSE([Total Sales], ROWS))</code>, format <code>0.0%</code>. Expand a category: each subcategory shows its share of the category.</p>`, check: () => visuals().some(v => Object.values(v.wells).flat().some(f => /COLLAPSE/i.test(f.calcExpr ?? ''))) },
      { title: 'Versus previous and hiding fields', html: `<p>On the line chart add <code>MoM = [Total Sales] - PREVIOUS([Total Sales])</code>. Then hide <b>Total Sales</b> on the visual (eye icon in the edit mode, or the field menu › Hide on the visual): the calculation still works.</p>${tip('Visual calculations are DAX over the visual matrix, stored in the visual (not the model, not reusable). They can only use fields on the visual. Use them for running totals, moving averages, % of parent/grand total and comparisons with previous/next/first/last.')}`, check: () => visuals().some(v => Object.values(v.wells).flat().some(f => f.hiddenInVisual)) },
    ],
    quiz: [
      { q: 'Where is a visual calculation stored?', options: ['In the semantic model', 'In the visual', 'In Power Query', 'In the report theme'], answer: 1, why: 'Visual calculations live in the visual and can\'t be reused elsewhere.' },
      { q: 'Which expression returns each row\'s share of its parent in a hierarchy?', options: ['DIVIDE([Sales], COLLAPSE([Sales], ROWS))', 'RUNNINGSUM([Sales])', 'DIVIDE([Sales], PREVIOUS([Sales]))', 'CALCULATE([Sales], ALL())'], answer: 0, why: 'COLLAPSE moves up one level of the row hierarchy.' },
    ],
  },
  {
    id: 'tooltipsync', area: 'Visualize and analyze the data', title: 'Report page tooltips and sync slicers', minutes: 10,
    summary: 'Build a tooltip page, assign it to a chart, and sync a slicer across pages (visible on one, filtering all).',
    setup: () => loadScenario('Tooltips and sync slicers', starScenario({ pages: [
      { name: 'Overview', visuals: [
        { type: 'slicer', x: 20, y: 20, w: 240, h: 220, wells: { field: [{ table: 'Date', column: 'Year' }] } },
        { type: 'clusteredColumn', x: 280, y: 20, w: 640, h: 340, wells: { axis: [{ table: 'Product', column: 'Category' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } },
      ] },
      { name: 'Details', visuals: [{ type: 'table', x: 20, y: 20, w: 700, h: 400, wells: { columns: [{ table: 'Store', column: 'StoreName' }, { table: 'Sales', measure: 'Total Sales' }] } }] },
      { name: 'Tooltip', visuals: [
        { type: 'card', x: 10, y: 10, w: 140, h: 90, wells: { values: [{ table: 'Sales', measure: 'Profit' }] } },
        { type: 'donut', x: 150, y: 10, w: 160, h: 220, wells: { axis: [{ table: 'Customer', column: 'Segment' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } },
      ] },
    ] })),
    steps: [
      { title: 'Make a tooltip page', html: `<p>Go to the <b>Tooltip</b> page. With nothing selected, in <b>Format › Page information</b> turn on <b>Allow use as tooltip</b>, and in <b>Canvas settings</b> set Type to <b>Tooltip</b>.</p>`, check: () => pages().some(p => p.isTooltip) },
      { title: 'Use it on a chart', html: `<p>Back on <b>Overview</b>, select the column chart › Format › <b>Tooltips</b> › Type <b>Report page</b> › Page <b>Tooltip</b>. Hover a column: the tooltip page shows Profit and the segment split <i>for that category</i>.</p>${tip('Report page tooltips are pages with "Allow use as tooltip" on (usually the Tooltip canvas size). Set Tooltip type to Report page on the visual, or use Auto with tooltip fields on the page.')}`, check: () => visuals().some(v => v.format?.tooltip?.type === 'page' && v.format.tooltip.pageId) },
      { title: 'Sync the slicer', html: `<p>Select the Year slicer › <b>View › Sync slicers</b>. Tick <b>Sync</b> for Overview and Details, and <b>Visible</b> only for Overview. Pick a year, then open Details: the table is filtered although no slicer is shown there.</p>${tip('Sync = the slicer filters that page; Visible = the slicer appears there. Slicers with the same group name sync even if their fields differ.')}`, check: () => visuals().filter(v => v.type === 'slicer' && v.syncGroup).length >= 2 },
    ],
    quiz: [
      { q: 'A slicer on page 1 must filter pages 2 and 3 without appearing on them. What do you configure?', options: ['Copy the slicer and hide it with a bookmark', 'Sync slicers: Sync on pages 1–3, Visible only on page 1', 'Report-level filter', 'Edit interactions'], answer: 1, why: 'The Sync slicers pane separates syncing (filtering) from visibility.' },
      { q: 'What must you set on a page for it to be used as a report page tooltip?', options: ['Drill through field', 'Allow use as tooltip', 'Hide page', 'Mobile layout'], answer: 1, why: 'Page information › Allow use as tooltip.' },
    ],
  },
  {
    id: 'analytics', area: 'Visualize and analyze the data', title: 'Forecast, anomalies, error bars, Analyze and clustering', minutes: 10,
    summary: 'Use the Analytics pane on a line chart, explain an increase with Analyze, and find clusters on a scatter chart.',
    setup: () => loadScenario('Analytics', starScenario({ visuals: [
      { type: 'line', x: 20, y: 20, w: 760, h: 320, wells: { axis: [{ table: 'Date', column: 'Year Month' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } },
      { type: 'scatter', x: 800, y: 20, w: 460, h: 320, wells: { details: [{ table: 'Customer', column: 'Customer Name' }], x: [{ table: 'Sales', measure: 'Order Count' }], y: [{ table: 'Sales', measure: 'Total Sales' }] } },
      { type: 'clusteredColumn', x: 20, y: 360, w: 760, h: 320, wells: { axis: [{ table: 'Date', column: 'Year' }], values: [{ table: 'Sales', measure: 'Total Sales' }] } },
    ] })),
    steps: [
      { title: 'Forecast and anomalies', html: `<p>Select the line chart › Visualizations › <b>Analytics</b>. Turn on <b>Forecast</b> (length 6, confidence 95%) and <b>Find anomalies</b>. Hover a red point to see its expected range.</p>`, check: () => visuals().some(v => v.format?.analytics?.forecast?.on || v.format?.analytics?.anomalies?.on) },
      { title: 'Explain the increase', html: `<p>On the column chart, right-click the <b>2024</b> column › <b>Analyze › Explain the increase</b>. Power BI ranks the fields (Category, Segment, Region…) by how much they explain the change from 2023.</p>`, check: () => true },
      { title: 'Clusters and error bars', html: `<p>Select the scatter chart › <b>More options (…) › Automatically find clusters</b> › OK. A new field <i>Customer Name (clusters)</i> is added to the Legend. Then on the column chart, Analytics › <b>Error bars</b> › Percentage 10%.</p>${tip('Forecast and anomaly detection need a line chart with a time axis and one value. Clustering is for scatter charts and creates a group field that doesn\'t update automatically. Error bars show a range from upper/lower bound fields or a percentage.')}`, check: () => tables().some(t => t.columns.some(c => /\(clusters\)/.test(c.name))) },
    ],
    quiz: [
      { q: 'Which visual supports the Forecast option in the Analytics pane?', options: ['Clustered bar chart', 'Line chart with a continuous date axis', 'Table', 'Pie chart'], answer: 1, why: 'Forecasting needs a line chart over time with a single measure.' },
      { q: 'Users want Power BI to find which categories caused a sales jump in March. What should they use?', options: ['Key influencers', 'Right-click › Analyze › Explain the increase', 'Q&A', 'Decomposition tree'], answer: 1, why: 'Analyze › Explain the increase finds the contributors to a change between two points.' },
    ],
  },
  {
    id: 'mobile', area: 'Visualize and analyze the data', title: 'Mobile layout, page refresh and report settings', minutes: 8,
    summary: 'Create a phone layout, set automatic page refresh on DirectQuery, and configure personalization and export settings.',
    setup: () => loadScenario('Mobile and settings', starScenario({ pages: OVERVIEW_PAGES })),
    steps: [
      { title: 'Mobile layout', html: `<p><b>View › Mobile layout</b>. Drag the cards and the column chart from <b>Page visuals</b> onto the phone canvas, resize them, then go back to the report. The mobile apps use this layout in portrait.</p>`, check: () => pages().some(p => p.mobile && Object.keys(p.mobile).length >= 2) },
      { title: 'Report settings', html: `<p><b>File › Options and settings › Options › Report settings</b>: turn on <b>Personalize visuals</b> and set <b>Export data</b> to summarized only. Readers can then change visuals for themselves in the service, and can't export underlying rows.</p>${tip('Personalize visuals lets readers swap fields and visual types without edit rights. Export settings: none, summarized, or summarized + underlying (underlying also needs Build).')}`, check: () => !!store.project.report.settings?.personalize },
      { title: 'Automatic page refresh', html: `<p>With nothing selected, open <b>Format › Page refresh</b> and turn it on. Because this model is <b>Import</b>, Power BI refuses: automatic page refresh needs a DirectQuery source. (Try it in the "Import, DirectQuery, Dual and Direct Lake" lab after connecting with DirectQuery.)</p>${tip('Automatic page refresh works only with DirectQuery. Fixed interval or change detection (a measure; Premium/Fabric). The admin sets a minimum interval.')}`, check: () => true },
    ],
    quiz: [
      { q: 'Phone users see the full landscape page, too small to read. What should the author do?', options: ['Change the theme', 'Create a mobile layout in Desktop', 'Use a dashboard', 'Use Focus mode'], answer: 1, why: 'View › Mobile layout creates a portrait layout for phones.' },
      { q: 'Automatic page refresh is greyed out. What\'s the most likely cause?', options: ['No bookmarks', 'The model uses Import mode', 'The page is hidden', 'RLS is on'], answer: 1, why: 'Automatic page refresh needs a DirectQuery source.' },
    ],
  },
  // ---------------------------------------------------------------- Manage and secure (service)
  {
    id: 'svc-roles', area: 'Manage and secure Power BI', title: 'Service: publish, workspace roles, sharing and RLS members', minutes: 15,
    summary: 'Publish to a workspace, compare what Admin, Contributor and Viewer can do, share with Build, and see RLS apply to Viewers only.',
    setup: async () => { await loadScenario('Contoso Sales', starScenario({ pages: OVERVIEW_PAGES, roles: [{ name: 'Store Managers', filters: { Store: '[ManagerEmail] = USERPRINCIPALNAME()' } }] })); await ensureSeedContent(); },
    steps: [
      { title: 'Publish', html: `<p><b>Home › Publish</b>. Choose the <b>Finance</b> workspace (you're Admin; it's a Pro workspace). Then select <b>Power BI service</b> in the title bar and open <b>Workspaces › Finance</b>: a semantic model and a report.</p>`, check: () => myItems().some(i => i.wsId === 'ws-fin' && i.type === 'Report') },
      { title: 'Roles', html: `<p>In Finance select <b>Manage access</b>. Add <b>Alex Rivera</b> as <b>Contributor</b>. Switch user (top right) to Alex: he can open and edit, but <b>Share</b> says Contributors can't share without Reshare. Switch to <b>Brooke Lee</b> (Free license): she can't see Finance at all, and a Pro workspace would need her to have Pro.</p>`, check: () => !!S().workspaces.find(w => w.id === 'ws-fin')?.access.some(a => a.principal === 'alex@contoso.com') },
      { title: 'RLS members and Viewers', html: `<p>Switch back to <b>Pat</b>. Open the <b>Contoso Sales</b> semantic model in Finance › <b>Security (RLS)</b> and add the group <b>Sales Managers</b> to <i>Store Managers</i>. Use <b>Test as role + user</b> with Brooke to see only her stores.</p><p>Now Share the report with <b>Dana Ortiz</b> (Read) and switch to Dana: she sees only the Online store. Add Dana to the workspace as Member and she sees everything — RLS doesn't apply to editors.</p>${tip('RLS applies to Viewers and people with Read (sharing, apps). Admin/Member/Contributor see all data. Assign security groups to roles in the service.')}`, check: () => myItems().some(i => i.wsId === 'ws-fin' && i.type === 'SemanticModel' && Object.values(i.rls ?? {}).some(m => m.length)) },
      { title: 'Build permission', html: `<p>Share the semantic model with <b>Chris Ng</b> and tick <b>Allow recipients to build content</b>. Switch to Chris, go back to Desktop and use <b>Get data › Power BI semantic models</b>: he can connect. Without Build he'd only see "Read only (Build needed)".</p>`, check: () => myItems().some(i => i.type === 'SemanticModel' && i.perms.some(p => p.principal === 'chris@contoso.com' && p.build)) },
    ],
    quiz: [
      { q: 'A Contributor tries to share a report and can\'t. What is the least-privilege fix?', options: ['Make them Admin', 'Make them Member, or give them Reshare on the report', 'Give them Build', 'Make them Viewer'], answer: 1, why: 'Sharing needs Member/Admin or Reshare permission.' },
      { q: 'Which users does RLS restrict?', options: ['Everyone', 'Viewers and people with Read through sharing or apps', 'Only Admins', 'Only free users'], answer: 1, why: 'Users who can edit the model (Admin, Member, Contributor) bypass RLS.' },
    ],
  },
  {
    id: 'svc-refresh', area: 'Manage and secure Power BI', title: 'Service: gateways, scheduled refresh, alerts and subscriptions', minutes: 15,
    summary: 'Map sources to a gateway, schedule refresh within the 8/48 limits, handle failures, pin tiles, set alerts and subscribe.',
    setup: async () => { await loadScenario('Contoso Sales', starScenario({ pages: OVERVIEW_PAGES })); await ensureSeedContent(); },
    steps: [
      { title: 'Gateway connections', html: `<p>In the service open <b>Sales Analytics › Contoso Sales</b> (semantic model) › <b>Gateway and cloud connections</b>. The CSV/Excel/JSON/XML files are on-premises, so each is mapped to a connection on <b>CONTOSO-GW01</b>. Set one to <i>(not mapped)</i> and select <b>Refresh now</b>: it fails. Map it back.</p>`, check: () => true },
      { title: 'Schedule and limits', html: `<p><b>Refresh</b> tab: turn on the schedule and try to add more than 8 times in the <b>Finance</b> (Pro) workspace, or 48 in Sales Analytics (Fabric). Add <code>pat@contoso.com</code> as a failure contact. Use <b>+1 day</b> in the top bar and look at the refresh history and your <b>Inbox</b>.</p>${tip('Shared capacity: 8 scheduled refreshes a day. Premium/PPU/Fabric: 48. After four consecutive failures the schedule is disabled. On-premises sources need a gateway; cloud sources need credentials only.')}`, check: () => myItems().some(i => i.type === 'SemanticModel' && i.history?.some(h => h.kind === 'Scheduled')) },
      { title: 'Dashboard and alert', html: `<p>Open the <b>Contoso Sales</b> report, click the <b>Total Sales</b> card, select <b>Pin visual</b> › New dashboard <i>Sales KPIs</i>. Open the dashboard › tile <b>…</b> › <b>Manage alerts</b>: Above 1,000,000. Advance the clock a day: the scheduled refresh triggers the alert email.</p>`, check: () => myItems().some(i => i.type === 'Dashboard' && i.tiles?.some(t => t.alerts.length)) },
      { title: 'Subscription', html: `<p>On the report select <b>Subscribe to report</b>, add <b>Alex Rivera</b>, choose <b>Daily</b> at 08:00 and attach PDF. Advance the clock and switch to Alex to read it. Recipients must have access, and each sees RLS-filtered data.</p>${tip('Alerts: personal, on card/KPI/gauge dashboard tiles, checked on refresh. Subscriptions: email snapshots of report pages or dashboards on a schedule or after refresh.')}`, check: () => myItems().some(i => (i.subs ?? []).length > 0) },
    ],
    quiz: [
      { q: 'A model imports from an on-premises SQL Server and a SharePoint Online list. What does scheduled refresh need?', options: ['A gateway for both', 'A gateway for SQL Server only; credentials for SharePoint Online', 'Nothing', 'A personal gateway for SharePoint'], answer: 1, why: 'Only on-premises sources need a gateway.' },
      { q: 'You can\'t set an alert on a dashboard tile. Which tile type supports alerts?', options: ['Line chart', 'Card', 'Map', 'Table'], answer: 1, why: 'Alerts work on card, KPI and gauge tiles.' },
    ],
  },
  {
    id: 'svc-govern', area: 'Manage and secure Power BI', title: 'Service: apps, endorsement, labels, lineage and pipelines', minutes: 15,
    summary: 'Publish an app with audiences, certify content, apply sensitivity labels, check impact analysis, and deploy with a pipeline.',
    setup: async () => { await loadScenario('Contoso Sales', starScenario({ pages: OVERVIEW_PAGES })); await ensureSeedContent(); },
    steps: [
      { title: 'App with audiences', html: `<p>In <b>Sales Analytics</b> select <b>Create app</b>. Content: tick Contoso Sales. Audience: keep <i>Entire organization</i> (All Employees). Publish. Switch to <b>Chris</b> › Apps › Get apps. Then change the report in Desktop, republish, and see that Chris still sees the old version until you <b>Update app</b>.</p>`, check: () => S().apps.some(a => !!a.published) },
      { title: 'Endorse and label', html: `<p>Open a semantic model's settings › <b>Endorsement and label</b>. Anyone with write can <b>Promote</b>; only the admin-approved certifiers (Admin portal › Certification) can <b>Certify</b>. Switch to Dana and try. Apply the <b>Confidential</b> label to the model: reports built on it inherit it, and exports carry it.</p>`, check: () => myItems().some(i => i.label === 'Confidential' || i.label === 'Highly Confidential') },
      { title: 'Lineage and impact analysis', html: `<p>Workspace › <b>Lineage view</b>. Select the semantic model to see the impact analysis: downstream reports and dashboards, including other workspaces.</p>`, check: () => true },
      { title: 'Deployment pipeline', html: `<p>Create two workspaces, <i>Sales Dev</i> and <i>Sales Test</i>, with license mode <b>Fabric F64</b> (a Pro workspace is refused). <b>Deployment pipelines › New pipeline</b>, assign them to Development and Test, add a <b>data source rule</b> on Test, then <b>Deploy to Test</b>.</p>${tip('Pipelines need Premium/PPU/Fabric. Rules swap data sources or parameter values per stage. Deployment copies metadata, not data: refresh in the target stage.')}`, check: () => S().pipelines.some(p => p.history.length > 0) },
    ],
    quiz: [
      { q: 'You need different users to see different reports from one workspace app. What do you use?', options: ['Two workspaces', 'App audiences', 'RLS', 'Bookmarks'], answer: 1, why: 'One app per workspace; audiences control which content each group sees.' },
      { q: 'Who can apply the Certified endorsement?', options: ['Any Contributor', 'Users authorized by the Fabric administrator', 'Workspace Viewers', 'Report owners only'], answer: 1, why: 'Certification is restricted to people the admin specifies in tenant settings.' },
    ],
  },
];

// keep the imports used by checks
void F; void item; void access;
