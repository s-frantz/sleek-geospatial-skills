/**
 * field-badge.js — the ONE field-row vocabulary: a monospace TYPE BADGE beside a FIELD NAME.
 *
 * Every surface that shows attributes renders the same two things, so they are built in one
 * place: the popup's field table and the table's header both call these, and therefore
 * cannot drift. Add a third surface (a filter panel, a field editor) and it inherits the
 * vocabulary for free.
 *
 * ── Why a badge and not a column header saying "type" ────────────────────────────────────
 * The badge is three monospace characters — `abc`, `123`, `0.0`, `dt`, `T/F` — coloured by
 * kind. At that size it reads as texture until you need it, and then it is exact. A word
 * would cost a column and would be read every time whether wanted or not.
 *
 * ── Types are INFERRED from the value, not declared ──────────────────────────────────────
 * GeoJSON has no schema, so the honest source of truth is what is actually in the property.
 * That has one consequence worth stating: `null` is its own badge rather than an absent one.
 * A field that is empty for THIS feature is a fact about this feature, and blanking the badge
 * would hide it.
 */

/**
 * @typedef {{label: string, title: string}} TypeInfo
 */

/**
 * Infer a type from a concrete value.
 * @param {unknown} value
 * @returns {TypeInfo}
 */
export function inferTypeFromValue(value) {
    if (value === null || value === undefined) return { label: 'null', title: 'null' };
    if (typeof value === 'boolean') return { label: 'T/F', title: 'boolean' };
    if (typeof value === 'number') {
        return Number.isInteger(value)
            ? { label: '123', title: 'integer' }
            : { label: '0.0', title: 'float' };
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T|\s)/.test(value)) {
        return { label: 'dt', title: 'datetime' };
    }
    return { label: 'abc', title: 'string' };
}

/**
 * The type of a whole COLUMN, for a table header: the first non-null value decides. A column
 * is one kind of thing in practice, and scanning every row to prove it would cost more than
 * the badge is worth.
 * @param {any[]} features
 * @param {string} field
 * @returns {TypeInfo}
 */
export function inferColumnType(features, field) {
    for (const f of features) {
        const v = f?.properties?.[field];
        if (v !== null && v !== undefined) return inferTypeFromValue(v);
    }
    return { label: 'null', title: 'null' };
}

/**
 * @param {TypeInfo|null} typeInfo
 * @returns {HTMLSpanElement}
 */
export function buildFieldBadge(typeInfo) {
    const badge = document.createElement('span');
    badge.className = 'sgs-field-badge';
    badge.textContent = typeInfo?.label ?? '?';
    badge.title = typeInfo?.title ?? '';
    badge.dataset.type = typeInfo?.title ?? '';
    return badge;
}

/**
 * The field-name span. Flex-grows and ellipsizes inside any flex row, so a long field name
 * shortens rather than pushing the value column off the edge.
 * @param {string} name
 * @returns {HTMLSpanElement}
 */
export function buildFieldNameSpan(name) {
    const span = document.createElement('span');
    span.className = 'sgs-field-name';
    span.textContent = String(name);
    return span;
}
