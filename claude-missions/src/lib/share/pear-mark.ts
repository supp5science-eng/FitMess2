/**
 * The FitMess pear mark, inlined as a base64 PNG (128x128, ~5 KB).
 *
 * The share card is painted by satori (`next/og`), which can only draw an
 * image it already holds the bytes for: a `/brand/...` path would mean an HTTP
 * round-trip on every card, and reading out of `public/` is not reliable inside
 * a serverless function bundle. Inlining the mark keeps a card render entirely
 * network-free -- part of why a card is now fast enough to build up front.
 *
 * Source of truth is `public/brand/fitmess-icon.png`; this is that file
 * downscaled to what the signature actually paints (~56 px on a 1080-wide card,
 * so 128 px covers it at 2x). Regenerate with `scripts/gen-pear-mark.cjs` if the
 * logo ever changes.
 */
export const PEAR_MARK_DATA_URI =
  "data:image/png;base64," +
  "iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAADAFBMVEVMaXGDhYrGzM64v8PNz9HBxMl+g4aVlJVRUFjs7u9u" +
  "bnK1ubpzc3Znd36JiI3l5efr7/D7+/xWenp4fH+gpKfMz9QoOUd6e4GGhozw8PKVmp9ob3VwcXVkZGlzdXlnZ2uSqKjM1dlW" +
  "X15zdXhpa2xykpHHx8uqq61oZmuPkJXw8PGfn6Ojoqfr6+5fXmJ6eny5u71pioz6+fmnqKxUXmr8/f2NjpLb2t2kpqh6hpCA" +
  "gYVxnJj19faLjJBrfIqbnqLKzNGEt7mXu8G2ub37/Py30dje2L3d07HEx8vFxckxZWAxU00pT04xYFo7TV80YWk+h3wvW1Uy" +
  "RWM7VHwoR04sVVNPpY81amQuQ2k+Xlg/cGg4WFdGZ5ByeWyLp49EUmA/X4ZHhnhknJRMhI42b2p3q5OCpZJIb2dGkINYkaI7" +
  "VWE9W2MvXmE7VEosPWVRampTeXAsO1s8bXVOkpJWmYKJiGZTiXlQdGYzUlRUgnE3SFlHYGJFVUosTEk8Zl1XkX1JfnNCd31b" +
  "eqRMa1xmpYs0ZW05fHZ3jXlLmYtkmaVblouFiYwvXIYzSk9WbXR9nIRKXnGHn4eYr5VHg4RNVF5LbppfdmFdh3ZGeG1xl4KK" +
  "kJUsRHCOmJ2Zk22SrJg+ZGhRc4ispn1Vh4NFamB9gGJue2KdtJJXbV5dfZEwP1ClrohQc6FMXFMsT3tneWw4SWuovZZdq5E5" +
  "Y3RRbJJcfXBbd2tzgnE7dm5mvKVBaHm0solYYVUwTHNnbFnV3eBok350oYs9UG6Vqot0xKSUwZ1ciZhSm5WIq5qEtZQ6amSR" +
  "tZPh5eg7TUxpg3JkjHtWo5tdr6F9raNikpVopZuftpqjm3QtUVvJyp2uuqJXmq7Nw49mvr5Mf6RlnIW8u5MqRlppsZpgpa+5" +
  "wZ5jr7ian6KrsplLYIdVa35zuJqExKJxt7gzWGB7vL42apE9d5tnsq2KlHZDUFZ8sq6YnZKqsbd4dVpKboBIeYmco4VXhJ1+" +
  "mJecsK+SoYBsp6tmkYfHx7y/GAqXAAAAo3RSTlMADv79F/78AQMDMf4e/oRI/uD+/f79/qpKuPz+clL43P3+/I35/jP7rM5l" +
  "Wnnhi9eV/Z67/sDufCz+Zv6Cov3d2f793/f8/P26cf//////////////////////////////////////////////////////" +
  "///////////////////////////////////////////////////////////////+qrCCTAAAAAlwSFlzAAAD6AAAA+gBtXtS" +
  "awAAEAdJREFUeNrtm3lUVVXbwA9c7sT0IoPMCgoizoZjvmpavRWjXEEmA0VmMOZZpgARkFkFrhACKojGJGKQIpAzggOCZmJp" +
  "mCaWKOSE2vc8+1ywWut7/7n30HrX6lnLldUfv99+9rP32fs551LUP/FP/E8E9238LXz+Wyyfz/9bFHhSMhhSaMLlj3Ma+NS/" +
  "3lk4gcRCzXdmTOP9KSXjIvDOB6yRIgi9EXaL0oSFM6SocZ0IEGjx3/P0aRmEckGAIUtp9mIpahzLkU/9u8PwdSpGd7drWlm8" +
  "8kiH5rS/TgODQnxqsdJ8xF+5csXV1bW7Oy3sjXTLLIr/l4XCZbAIlV7e/vF1qjdtgA5lIy2z/rApcPmUjAxjBlxKfsLq1Aev" +
  "b3ufOjVmEKYHOeC+dZwx+z0N5nLA09TvfvDj7dS3Bq7dZXrsmRRvrEqUpNXel2fKAIrgg8sPvvuTwWnXMhZLlq4D5LNZbGlF" +
  "is+UwLQPRl5/RwxenLpiaLjMNQ3CsMWExxXVCBuCxZgAlJhmy+nv0MD7xYtT8w1bW/vepJ0uG5bWACTozVZjS7NVjZkrQz41" +
  "U+nJIxD48VvvF5WV87NycgohBfP1TWD5cfmaLchXl2euCLmU1Hst3SQF34JApWFOu3NW4RvlETmsghkdLGk54VQpisG9kUfN" +
  "7PjwbQpWpA/drXpVWGYIdceVmS3NluPoMLw383kmSqsfYQaIwVLh3ebm51kp0iZSsE+z2em6TD8gudSS9ztW3SYCWIiGRWgw" +
  "KMeeKTNbX7pfh+Ix/WyCSZBrWeX9LQp4e58yfDl099atquvs9z9RU2MtH49nI4+aZaS22lukcIU2uPO7KovNXik/uiUyOglg" +
  "oMX+cJV3sLc3PhqXeeSCwe9CVWkjnfHg07vBSnbLh6tTcRK8U5edUb0LAkbSi+Sp8TmcQA5kZhmx1PQ/XP3kyevXly/r3b0u" +
  "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" +
  "/5Pxf5Y3MFx6mEREAAAAAElFTkSuQmCC";
