Naqsha demo files (made by us, no third-party content)

cards/  Photos of punched cards for the Scan screen. All use the built-in demo card layout (12 rows x 16 columns). They are drawn by our own code, not photos of real cards.
  card-1-clean.png, card-2-clean.png, card-3-clean.png  clean, straight: reads with no fixes
  card-1-tilted.png                                      turned a few degrees: tests straightening
  card-1-noisy.png                                       grainy: tests noise
  card-1-noisy-tilted.png                                grainy and turned: the hardest one
  card-blank-should-fail.png                             no card in the picture: Scan must say it cannot find the peg holes

loom-files/  What Keep exports for an electronic Jacquard loom: one row per pick, one pixel per thread.
  diamond-1bit.bmp   192 x 200, 1 bit per pixel
  diamond-8bit.bmp   192 x 200, 8 bits per pixel (palette)
Open them in any image viewer. The demo card layout is illustrative and not checked against a real loom.
