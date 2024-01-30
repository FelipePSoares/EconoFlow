const PROXY_CONFIG = [
  {
    context: [
      "/api",
      "/weatherforecast",
    ],
    target: "http://localhost:7003",
    secure: false
  }
]

module.exports = PROXY_CONFIG;
