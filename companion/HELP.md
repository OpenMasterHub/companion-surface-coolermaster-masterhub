## MasterHub USB surface

This surface opens the MasterHub over USB and does not use `masterhubd`. No connection is added; the modules appear when they are plugged in. Quit `masterhubd` and close OpenDeck first, because they open the same USB devices.

The surface appears when a keypad, knob, roller, slider, or dial module is plugged in. The base on its own appears as one color control. Hot-plugging a module reopens the surface.

Companion draws the 15 keys at 72×72 and the dial at 240×240. The surface brightness control is the keypad backlight and the knob, slider, and base LEDs together.

### Layout

Controls stack: keys, rollers, sliders, then the knobs beside the dial. A base-only setup is a single color cell. Pogo-site placement is not available over USB.

Companion remembers buttons by grid position, so moving a module moves which buttons it presses. Roller hardware control 0 is the right roller. Slider moves become encoder turns, and the first reading after connect only stores the position. Each slider also publishes `slider_0` through `slider_4` as a value from 0 to 100.

With the keypad connected, pincode entry uses the first ten keys as digits 0 through 9. While the surface is locked, the keys and the dial are cleared.

### Debug logging

Start Companion with `MASTERHUB_DEBUG=1` to have the surface log draw, JPEG encoding, and USB transfer timings to the Companion log once per second, plus a line for any step slower than its budget. It is off by default and applies to all MasterHub surfaces; with it off, the surface only logs USB errors.

### LEDs

A knob, slider, or dial cell takes its color from the button style on that cell and shows a solid color. LED effect modes (breathing, strobe, rainbow, and the rest) are actions on the MasterHub connection module and need `masterhubd`.
