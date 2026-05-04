CREATE OR REPLACE FUNCTION prevent_ledger_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_events are immutable and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_events_prevent_update ON ledger_events;
CREATE TRIGGER ledger_events_prevent_update
BEFORE UPDATE ON ledger_events
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_event_mutation();

DROP TRIGGER IF EXISTS ledger_events_prevent_delete ON ledger_events;
CREATE TRIGGER ledger_events_prevent_delete
BEFORE DELETE ON ledger_events
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_event_mutation();
