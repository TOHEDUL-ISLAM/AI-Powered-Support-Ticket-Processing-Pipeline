// US-1.3: ticket_phases — one row per (ticket, step); tracks phase-level state and results
exports.up = (pgm) => {
  pgm.createTable('ticket_phases', {
    id: { type: 'bigserial', primaryKey: true },
    ticket_id: { type: 'uuid', notNull: true, references: '"tickets"', onDelete: 'CASCADE' },
    step_name: {
      type: 'text',
      notNull: true,
      check: "step_name IN ('triage','resolution')",
    },
    status: {
      type: 'text',
      notNull: true,
      check: "status IN ('pending','running','success','failed','permanently_failed')",
    },
    attempt_count: { type: 'integer', notNull: true, default: 0 },
    result: { type: 'jsonb' },
    provider_used: { type: 'text' },
    error_message: { type: 'text' },
    started_at: { type: 'timestamptz' },
    finished_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint(
    'ticket_phases',
    'ticket_phases_ticket_id_step_name_key',
    'UNIQUE (ticket_id, step_name)',
  );
  pgm.createIndex('ticket_phases', 'ticket_id', { name: 'ticket_phases_ticket_id_idx' });
  pgm.createIndex('ticket_phases', 'status', { name: 'ticket_phases_status_idx' });
};

exports.down = (pgm) => {
  pgm.dropTable('ticket_phases');
};
