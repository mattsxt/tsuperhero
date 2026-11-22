import { currentUserId } from "@/simulation/auth";
import { db, type Row, type TableName } from "@/simulation/db";

type Result = {
  data: unknown;
  error: { message: string; code: string } | null;
};
type Filter = (row: Row) => boolean;
type Mode = "select" | "insert" | "upsert" | "update" | "delete";
type Columns = {
  star: boolean;
  names: string[];
  embeds: { table: string; columns: Columns }[];
};

const primaryKey = (table: string) => `${table}_id`;

const store = (table: string): Row[] =>
  (db.tables as Record<string, Row[]>)[table] ?? [];

const splitTop = (text: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") depth--;
    else if (text[i] === "," && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
};

const parseColumns = (text: string): Columns => {
  const out: Columns = { star: false, names: [], embeds: [] };
  for (const part of splitTop(text)) {
    const open = part.indexOf("(");
    if (open > 0) {
      out.embeds.push({
        table: part.slice(0, open).trim(),
        columns: parseColumns(part.slice(open + 1, part.lastIndexOf(")"))),
      });
    } else if (part === "*") out.star = true;
    else out.names.push(part);
  }
  return out;
};

const project = (row: Row, parent: string, cols: Columns): Row => {
  const out: Row = {};
  if (cols.star) Object.assign(out, row);
  for (const name of cols.names) out[name] = row[name] ?? null;
  for (const embed of cols.embeds) {
    const fk = primaryKey(parent);
    out[embed.table] = store(embed.table)
      .filter((c) => c[fk] === row[fk])
      .map((c) => project(c, embed.table, embed.columns));
  }
  return out;
};

const compare = (a: unknown, b: unknown): number => {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return (a as string | number) < (b as string | number) ? -1 : 1;
};

export class QueryBuilder implements PromiseLike<Result> {
  private mode: Mode = "select";
  private columns: Columns = { star: true, names: [], embeds: [] };
  private filters: Filter[] = [];
  private orders: { column: string; ascending: boolean }[] = [];
  private max: number | null = null;
  private payload: Row[] = [];
  private options: { onConflict?: string; ignoreDuplicates?: boolean } = {};
  private patch: Row = {};
  private returning = false;
  private cardinality: "many" | "single" | "maybe" = "many";

  private readonly table: TableName;

  constructor(table: TableName) {
    this.table = table;
  }

  select(columns = "*"): this {
    if (this.mode !== "select") this.returning = true;
    this.columns = parseColumns(columns);
    return this;
  }

  insert(row: Row | Row[]): this {
    this.mode = "insert";
    this.payload = Array.isArray(row) ? row : [row];
    return this;
  }

  upsert(
    row: Row | Row[],
    options: { onConflict?: string; ignoreDuplicates?: boolean } = {},
  ): this {
    this.mode = "upsert";
    this.payload = Array.isArray(row) ? row : [row];
    this.options = options;
    return this;
  }

  update(patch: Row): this {
    this.mode = "update";
    this.patch = patch;
    return this;
  }

  delete(): this {
    this.mode = "delete";
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((r) => r[column] === value);
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push((r) => r[column] !== value);
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push((r) => values.includes(r[column]));
    return this;
  }

  is(column: string, value: unknown): this {
    this.filters.push((r) => (r[column] ?? null) === value);
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}): this {
    this.orders.push({ column, ascending: options.ascending !== false });
    return this;
  }

  limit(count: number): this {
    this.max = count;
    return this;
  }

  single(): this {
    this.cardinality = "single";
    return this;
  }

  maybeSingle(): this {
    this.cardinality = "maybe";
    return this;
  }

  then<R1 = Result, R2 = never>(
    onfulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return new Promise<Result>((resolve) =>
      setTimeout(() => resolve(this.run()), 0),
    ).then(onfulfilled, onrejected);
  }

  private matching(): Row[] {
    const uid = currentUserId();
    return store(this.table).filter((r) => {
      if (this.table === "notification" && uid && r.user_id !== uid) return false;
      return this.filters.every((f) => f(r));
    });
  }

  private finish(matched: Row[]): Result {
    let rows = matched;
    for (const { column, ascending } of [...this.orders].reverse()) {
      rows = [...rows].sort(
        (a, b) => compare(a[column], b[column]) * (ascending ? 1 : -1),
      );
    }
    if (this.max !== null) rows = rows.slice(0, this.max);
    const shaped = rows.map((r) => project(r, this.table, this.columns));
    if (this.cardinality === "many") return { data: shaped, error: null };
    if (shaped.length === 1) return { data: shaped[0], error: null };
    if (shaped.length === 0 && this.cardinality === "maybe") {
      return { data: null, error: null };
    }
    return {
      data: null,
      error: {
        message: "JSON object requested, multiple (or no) rows returned",
        code: "PGRST116",
      },
    };
  }

  private output(rows: Row[]): Result {
    return this.returning ? this.finish(rows) : { data: null, error: null };
  }

  private create(input: Row): Row {
    const row: Row = { ...input };
    const pk = primaryKey(this.table);
    if (this.table !== "user" && row[pk] === undefined) row[pk] = db.id();
    store(this.table).push(row);
    db.emit({ table: this.table, type: "INSERT", row });
    return row;
  }

  private change(row: Row, patch: Row): void {
    const old = { ...row };
    Object.assign(row, patch);
    db.emit({ table: this.table, type: "UPDATE", row: { ...row, __old: old } });
  }

  private run(): Result {
    switch (this.mode) {
      case "select":
        return this.finish(this.matching());
      case "insert":
        return this.output(this.payload.map((p) => this.create(p)));
      case "upsert": {
        const key = this.options.onConflict ?? primaryKey(this.table);
        const out: Row[] = [];
        for (const p of this.payload) {
          const existing = store(this.table).find((r) => r[key] === p[key]);
          if (!existing) out.push(this.create(p));
          else if (!this.options.ignoreDuplicates) {
            this.change(existing, p);
            out.push(existing);
          }
        }
        return this.output(out);
      }
      case "update": {
        const matched = this.matching();
        for (const r of matched) this.change(r, this.patch);
        return this.output(matched);
      }
      case "delete": {
        const matched = this.matching();
        const rows = store(this.table);
        for (const r of matched) {
          rows.splice(rows.indexOf(r), 1);
          db.emit({ table: this.table, type: "DELETE", row: r });
        }
        return this.output(matched);
      }
    }
  }
}
