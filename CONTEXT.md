# Thecore VS Code Extension

Scaffolds and manages Thecore 3 Ruby on Rails applications and their modular engines. This glossary covers the extension's domain language; the Thecore framework itself is documented upstream.

## Language

**ATOM**:
A self-contained Rails engine, packaged as a gem, living directly under `vendor/submodules/` of a Main App and extending it.
_Avoid_: submodule (alone), plugin, engine

**Main App**:
The host Thecore 3 Ruby on Rails application at the workspace root, into which ATOMs are mounted.
_Avoid_: app (ambiguous), workspace, main ruby on rails app

**Root Action**:
A `rails_admin` backend UI action presented as a top-level navigation entry, not bound to any record.

**Member Action**:
A `rails_admin` backend UI action bound to a single record, presented as a per-row button in a model's list view.

**Target**:
What a Dual-context Command generates code into: the owning ATOM when invoked from anywhere inside that ATOM's folder tree, otherwise the Main App. Command Palette invocations (no clicked folder) target the Main App.
_Avoid_: context (collides with VS Code's "context menu" and `ExecutionContext`)

**Dual-context Command**:
An extension command that can generate into either Target: Add a Model, Add a DB Migration, Add a Root Action, Add a Member Action.
_Avoid_: ATOM command, app command
