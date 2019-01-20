workflow "New workflow" {
  on = "push"
  resolves = ["yarn install", "yarn test"]
}

action "yarn install" {
  uses = "\tnuxt/actions-yarn@master"
  runs = "install"
}

action "yarn build" {
  uses = "nuxt/actions-yarn@master"
  needs = ["yarn install"]
  runs = "build"
}

action "yarn test" {
  uses = "nuxt/actions-yarn@master"
  needs = ["yarn build"]
  runs = "test"
}
