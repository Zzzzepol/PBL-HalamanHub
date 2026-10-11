# HalamanHub UI guide

## Theme

- Light screens use white cards on a soft grey page background.
- Nursery green is shared by the admin and shop: dark green `#14532d`, action green `#166534`, and light green `#e8f7ef`.
- Card borders use a clear 1px line. Corners are rounded, with subtle shadows for raised content.
- Admin and shop fonts load from local npm packages: Inter, Tabler Icons, and Playfair Display for shop headings. They do not rely on font CDNs.

## Type scale

| Size | Use |
| --- | --- |
| 12px | Helper text and small labels |
| 14px | Secondary text and compact controls |
| 15px | Admin body text |
| 18px | Section headings |
| 22px | Card values and page headings |
| 28px | Main figures and large headings |

Shop text uses a 16px body size on phones. Buttons and inputs have at least a 44px touch height. Keyboard focus is visible and reduced-motion preferences are respected.

## Status wording

| Status | Color | Icon | Use |
| --- | --- | --- | --- |
| Good | Green | Check | Readings and work are in a healthy state |
| Check soon | Amber | Warning | Keep an eye on this item |
| Needs action | Red | Alert | Something needs attention now |
| No data | Grey | Dash | The device has not sent a reading |

Always show the status word with its icon and color. A missing sensor signal uses calm grey language such as “No signal”.

## Shared UI pieces

- `StatusBadge`: consistent status word, icon, and color.
- `BigStat`: a plain-language reading with its unit and status.
- `ConfirmDialog`: confirmation before water controls, cancellation, and deletion.
- `EmptyState`, `ErrorState`, and `LoadingSkeleton`: clear next steps while data loads or is missing.
- `timeAgo()`: one relative-time format within each app.
- `Button`, `Input`, and `Select`: visible focus styles and large touch areas.

## Plain-language labels

| Technical label | Screen wording |
| --- | --- |
| NPK / Nitrogen, Phosphorus, Potassium | Plant food levels (N, P, K) |
| EC / µS/cm | Soil salt level (EC) |
| pH | Soil acidity (pH) |
| TDS | Water purity (TDS) |
| Soil moisture | Soil wetness |
| Solenoid | Backup water line |
| Pump | Water pump |
| Inactive sensor | No signal; include the last-seen time |
| Sensor monitoring | Sensors |
| Irrigation control | Watering |
| Rainwater harvesting | Rain tank |
| Analytics | History and trends |
| Point of sale | Walk-in sale |
| Activity logs | Activity history |

Keep the scientific name beside the plain label when it helps staff learn the term.
