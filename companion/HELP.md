### What appears

Every connected MasterHub module (keypad, sliders, knobs, rollers, dial, base) shows up as one **MasterHub** surface. There is no device to add by IP or serial: the surface appears when you plug a module in and goes away when you remove all of them.

### Buttons

| Module  | Controls                                      | Each cell shows      |
| ------- | --------------------------------------------- | -------------------- |
| Keypad  | 15 keys, rows 0–2                             | 72×72 button image   |
| Sliders | 5 sliders, row 3                              | LED color            |
| Knobs   | 3 knobs, and the 2 rollers beside them, row 4 | LED color            |
| Dial    | the dial, row 5                               | 240×240 button image |
| Base    | 1 cell, row 5                                 | LED color            |

- The grid is fixed, so a missing module leaves a gap instead of moving the modules around it. The surface remembers buttons by grid position: an empty cell is still where its button lives when the module comes back.
- Slider 1 is the leftmost slider in Companion.
- On knob, slider, and base cells the button style's color is sent to the LED as a solid color. Animated styles (breathing, strobe, rainbow, …) are not shown on these LEDs.
- **Brightness** in the surface settings sets the keypad backlight and the knob, slider, and base LEDs together.

### Sliders

Moving a slider also counts as turning the encoder on its cell, so an encoder button there reacts to slider movement. The first reading after connecting only records the position, so plugging in does not turn the encoder.

Each slider also publishes a variable you can use in triggers and feedbacks:

| Variable               | Slider    |
| ---------------------- | --------- |
| `$(internal:slider_1)` | leftmost  |
| …                      |           |
| `$(internal:slider_5)` | rightmost |

The value runs from 0 to 100.

### Keyboard lock

When Companion's surface is locked, the keypad's first ten keys type the PIN digits 0–9 and the keys and dial are blanked until you unlock, so they do not show the buttons underneath.
