// US-1.3: tickets — core record, one row per submitted ticket
exports.up = (pgm) => {
  pgm.createTable('tickets', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    tenant_id: { type: 'text', notNull: true },
    submitter: { type: 'text', notNull: true },
    subject: { type: 'text', notNull: true },
    body: { type: 'text', notNull: true },
    status: {
      type: 'text',
      notNull: true,
      check: "status IN ('queued','processing','completed','failed')",
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('tickets', ['tenant_id', { name: 'created_at', sort: 'DESC' }], {
    name: 'tickets_tenant_created_at_idx',
  });
  pgm.createIndex('tickets', 'status', { name: 'tickets_status_idx' });
};

exports.down = (pgm) => {
  pgm.dropTable('tickets');
};
