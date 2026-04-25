// US-1.3: ticket_events — append-only audit log, one row per event per ticket
exports.up = (pgm) => {
  pgm.createTable('ticket_events', {
    id: { type: 'bigserial', primaryKey: true },
    ticket_id: { type: 'uuid', notNull: true, references: '"tickets"', onDelete: 'CASCADE' },
    event_type: { type: 'text', notNull: true },
    step_name: { type: 'text' },
    metadata: { type: 'jsonb' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('ticket_events', ['ticket_id', { name: 'created_at', sort: 'ASC' }], {
    name: 'ticket_events_ticket_id_created_at_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('ticket_events');
};
