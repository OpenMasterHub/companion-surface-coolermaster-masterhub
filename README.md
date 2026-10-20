# MasterHub USB surface for Companion

Use a Cooler Master MasterHub as a [Bitfocus Companion](https://bitfocus.io/companion) surface over direct USB.

The plugin opens the MasterHub HID devices itself. Every connected module (keypad, slider, knob, roller, dial, base) appears as a Companion surface as soon as it is plugged in. There is no device to add by IP or serial:

1. Download the `.tgz` file from the [latest GitHub release](https://github.com/OpenMasterHub/companion-surface-coolermaster-masterhub/releases/latest) and install it as a Companion module, then restart Companion.
2. Plug in the MasterHub modules. A "MasterHub" surface appears in Companion's surfaces settings.

## Controls

| Module         | Model  | Controls                                                | Display            |
| -------------- | ------ | ------------------------------------------------------- | ------------------ |
| Keypad         | M4315  | `key/0` … `key/14`                                      | 72×72 JPEG per key |
| Slider (fader) | M005S  | `slider/0` … `slider/4`                                 | LED color          |
| Knob           | M003K  | `knob/0` … `knob/2`                                     | LED color          |
| Roller         | M032LE | `roller/0`, `roller/1` (`roller/0` is the right roller) | LED color          |
| Dial           | 1xDial | `dial` (press and rotate)                               | 240×240 JPEG       |
| Base           | M0064  | `base`                                                  | LED color          |

- **Keys and dial** show button images. Companion draws the dial at 240×240.
- **Knobs, sliders, rollers, and base** are encoder-style controls without a screen. A button placed on that cell supplies its color as a solid LED color. LED _animations_ (breathing, strobe, rainbow, …) are not supported.
- **Brightness** in Companion's surface settings drives the keypad backlight and the knob, slider, and base LEDs together.
- **Sliders** also publish `slider_1` … `slider_5` to Companion as values from 0 to 100. Slider movement is sent as encoder turns; the first reading after connecting only stores the position, so connecting does not turn the encoder.
- **Pincode entry** on a locked Companion uses the first ten keys of the keypad as digits 0–9. While locked, keys and dial are blanked.

## Layout

Companion remembers buttons by grid position, so the surface is a fixed grid and a missing module leaves a gap instead of shifting the others:

- rows 0–2: the 15 keys
- row 3: the 5 sliders
- row 4: 3 knobs and the 2 rollers
- row 5: the dial and the base

A base-only setup is a single color cell. The stacked layout is always used because the USB surface has no pogo-site information; moving a module to a different place in the chassis does not move its cells (and therefore its buttons).

The controls are fixed when the surface opens. Unplugging a module keeps the surface and the other modules running and leaves its cells blank; its input and last image or color are picked up again when it is plugged back in. Adding a module that was not present when the surface opened needs the surface to be reopened.

## Development

Requires Node 26 and pnpm.

```sh
pnpm install
pnpm --filter "companion-surface-masterhub-usb..." build
```

- `pnpm run dev` recompiles on change while Companion's developer modules directory points at this repository.
- `pnpm run test` runs the unit tests.
- `pnpm run lint` and `pnpm run format` for lint and formatting.
- `pnpm run package` builds the plugin into `pkg/` for distribution.
- Start Companion with `MASTERHUB_DEBUG=1` to log draw, JPEG encoding, and HID flush timings once per second. The lines go to Companion's log file and the module's process output; with debug off, the plugin logs nothing except failures.

Keep OpenDeck closed while using the surface.

See [companion/HELP.md](companion/HELP.md) for the in-Companion help text.

## Licence

MIT — see [LICENSE](LICENSE).
