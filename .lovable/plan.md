# Deleted addresses reappearing in "My Projects" and on the map

## Confirmed problem
A customer can delete an address when every order on it is still "awaiting approval". The address is only switched off and its awaiting-approval orders are kept. The "My Projects" list and the map now show any address that has orders, even switched-off ones. That was a deliberate change so addresses with archived or active orders never disappear. As a result, a deleted address comes back after refresh.

## Proposed fix
Deleting an address does what the customer expects, and addresses that still have real orders stay protected.

1. **Deleting an address also removes its awaiting-approval orders and empty projects.** Only orders still awaiting approval are removed, so a delete can never touch approved, archived or paid orders. The confirmation text will say so, for example: "Your awaiting-approval orders at this address will be removed too."
2. **Every place a customer can delete an address works the same way:** the "My Projects" page, the projects tab in the profile, and the map.
3. **Addresses with approved, archived or paid orders keep showing.** This covers the rule that an archived address stays until everything is removed and a month has passed, and addresses the hourly cleanup switches off.

## Technical details
- `MyProjectsHierarchy.tsx` `handleDeleteLocation`, the matching delete in `HybridGlobe.tsx`, and `useLocations.ts`: before setting `locations.is_active = false`, delete `projects_v3` rows with `status = 'pending'` under that location's `projects_hierarchy`, then delete the now-empty `projects_hierarchy` rows. `canDeleteLocation` already blocks deletion when any non-pending order exists.
- No change to the `is_active` filtering in `MyProjectsHierarchy.tsx`, `MyProjectsTab.tsx` or `forceActiveForVisibleOrders`. Once the orders are gone, those addresses drop out on their own through `addressesWithOrders`.
- Check: delete an address that has one awaiting-approval order, refresh, and confirm it is gone from "My Projects" and the map. An address with an approved order still can't be deleted.

## Open question
If you would rather keep the awaiting-approval orders and only hide the address, I would instead add a separate "deleted by customer" flag on the address and filter on it. Pick that option when approving if you prefer it.
