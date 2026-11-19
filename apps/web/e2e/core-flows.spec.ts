import { randomUUID } from "node:crypto"
import { expect, test } from "playwright/test"

test("admin can sign in and create a project", async ({ page }) => {
  const name = `Browser project ${randomUUID()}`

  await page.goto("/login")
  await page.getByRole("textbox", { name: "Email" }).fill("demo@example.com")
  await page.getByLabel("Password").fill("demo-password")
  await page.getByRole("button", { name: "Login" }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto("/projects?perPage=20")
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible()

  await page.getByRole("button", { name: "Add Project" }).click()
  const dialog = page.getByRole("dialog", { name: "Add Project" })
  await dialog.getByRole("textbox", { name: "Name" }).fill(name)
  await dialog
    .getByRole("textbox", { name: "Description" })
    .fill("Created by the browser test")
  await dialog.getByRole("button", { name: "Add Project" }).click()

  await expect(page.getByRole("link", { name })).toBeVisible()
})

test("a new account has no workspace access until assigned a role", async ({
  page,
}) => {
  await page.goto("/signup")
  await page.getByRole("textbox", { name: "Name" }).fill("New Account")
  await page
    .getByRole("textbox", { name: "Email" })
    .fill(`new-${randomUUID()}@example.com`)
  await page.getByLabel("Password").fill("signup-password")
  await page.getByRole("button", { name: "Sign Up" }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(
    page.getByRole("heading", { name: "Access pending" })
  ).toBeVisible()
})
