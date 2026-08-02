#!/bin/sh
# packages/renderer/scripts/setup.sh — CardConjurer clone bootstrap.
#
# Phase 1a: not yet used. Today CC is cloned by v1's server/card-conjurer.sh into
# server/.cardconjurer/, and the node bridge in src/cardconjurer/node.js reads from there
# (via KP_CARDCONJURER_PATH override). Moving the clone under
# packages/renderer/external/cardconjurer/ and pinning to CARDCONJURER_PIN lands with the
# Phase 1b faithful port. See docs/v2-architecture.md §10 (locked decisions) and §4
# (CardConjurer update workflow).

echo "packages/renderer/scripts/setup.sh: placeholder (Phase 1b). Using server/.cardconjurer for now."
exit 0
