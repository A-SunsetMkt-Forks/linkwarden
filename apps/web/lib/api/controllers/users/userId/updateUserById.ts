import { prisma } from "@linkwarden/prisma";
import { AccountSettings } from "@linkwarden/types";
import bcrypt from "bcrypt";
import { removeFile, createFile, createFolder } from "@linkwarden/filesystem";
import sendChangeEmailVerificationRequest from "@/lib/api/sendChangeEmailVerificationRequest";
import { i18n } from "next-i18next.config";
import { UpdateUserSchema } from "@linkwarden/lib/schemaValidation";

const emailEnabled =
  process.env.EMAIL_FROM && process.env.EMAIL_SERVER ? true : false;

export default async function updateUserById(
  userId: number,
  body: AccountSettings
) {
  const dataValidation = UpdateUserSchema().safeParse(body);

  if (!dataValidation.success) {
    return {
      response: `Error: ${
        dataValidation.error.issues[0].message
      } [${dataValidation.error.issues[0].path.join(", ")}]`,
      status: 400,
    };
  }

  const data = dataValidation.data;

  const userIsTaken = await prisma.user.findFirst({
    where: {
      id: { not: userId },
      OR: emailEnabled
        ? [
            {
              username: data.username.toLowerCase(),
            },
            {
              email: data.email?.toLowerCase(),
            },
          ]
        : [
            {
              username: data.username.toLowerCase(),
            },
          ],
    },
  });

  if (userIsTaken) {
    if (data.email?.toLowerCase().trim() === userIsTaken.email?.trim())
      return {
        response: "Email is taken.",
        status: 400,
      };
    else if (
      data.username?.toLowerCase().trim() === userIsTaken.username?.trim()
    )
      return {
        response: "Username is taken.",
        status: 400,
      };

    return {
      response: "Username/Email is taken.",
      status: 400,
    };
  }

  // Avatar Settings

  if (
    data.image?.startsWith("data:image/jpeg;base64") &&
    data.image.length < 1572864
  ) {
    try {
      const base64Data = data.image.replace(/^data:image\/jpeg;base64,/, "");

      createFolder({ filePath: `uploads/avatar` });

      await createFile({
        filePath: `uploads/avatar/${userId}.jpg`,
        data: base64Data,
        isBase64: true,
      });
    } catch (err) {
      console.log("Error saving image:", err);
    }
  } else if (data.image?.length && data.image?.length >= 1572864) {
    console.log("A file larger than 1.5MB was uploaded.");
    return {
      response: "A file larger than 1.5MB was uploaded.",
      status: 400,
    };
  } else if (data.image == "") {
    removeFile({ filePath: `uploads/avatar/${userId}.jpg` });
  }

  // Email Settings

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (user && user.email && data.email && data.email !== user.email) {
    if (!data.password) {
      return {
        response: "Invalid password.",
        status: 400,
      };
    }

    // Verify password
    if (!user.password) {
      return {
        response:
          "User has no password. Please reset your password from the forgot password page.",
        status: 400,
      };
    }

    const passwordMatch = bcrypt.compareSync(data.password, user.password);

    if (!passwordMatch) {
      return {
        response: "Password is incorrect.",
        status: 400,
      };
    }

    sendChangeEmailVerificationRequest(
      user.email,
      data.email,
      data.name?.trim() || user.name || "Linkwarden User"
    );
  }

  // Password Settings

  if (data.newPassword || data.oldPassword) {
    if (!data.oldPassword || !data.newPassword)
      return {
        response: "Please fill out all the fields.",
        status: 400,
      };
    else if (!user?.password)
      return {
        response:
          "User has no password. Please reset your password from the forgot password page.",
        status: 400,
      };
    else if (!bcrypt.compareSync(data.oldPassword, user.password))
      return {
        response: "Old password is incorrect.",
        status: 400,
      };
    else if (data.newPassword?.length < 8)
      return {
        response: "Password must be at least 8 characters.",
        status: 400,
      };
    else if (data.newPassword === data.oldPassword)
      return {
        response: "New password must be different from the old password.",
        status: 400,
      };
  }

  // Other settings / Apply changes

  const isInvited =
    user?.name === null && user.parentSubscriptionId && !user.password;

  if (isInvited && data.password === "")
    return {
      response: "Password is required.",
      status: 400,
    };

  const saltRounds = 10;
  const newHashedPassword = bcrypt.hashSync(
    data.newPassword || data.password || "",
    saltRounds
  );

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      name: data.name,
      username: data.username,
      isPrivate: data.isPrivate,
      image:
        data.image && data.image.startsWith("http")
          ? data.image
          : data.image
            ? `uploads/avatar/${userId}.jpg`
            : "",
      collectionOrder: data.collectionOrder?.filter(
        (value, index, self) => self.indexOf(value) === index
      ),
      aiTaggingMethod: data.aiTaggingMethod,
      aiPredefinedTags: data.aiPredefinedTags,
      aiTagExistingLinks: data.aiTagExistingLinks,
      locale: i18n.locales.includes(data.locale || "") ? data.locale : "en",
      archiveAsScreenshot: data.archiveAsScreenshot,
      archiveAsMonolith: data.archiveAsMonolith,
      archiveAsPDF: data.archiveAsPDF,
      archiveAsReadable: data.archiveAsReadable,
      archiveAsWaybackMachine: data.archiveAsWaybackMachine,
      linksRouteTo: data.linksRouteTo,
      preventDuplicateLinks: data.preventDuplicateLinks,
      referredBy:
        !user?.referredBy && data.referredBy ? data.referredBy : undefined,
      password:
        isInvited || (data.newPassword && data.newPassword !== "")
          ? newHashedPassword
          : undefined,
    },
    include: {
      whitelistedUsers: true,
      subscriptions: true,
      dashboardSections: true,
      parentSubscription: {
        include: {
          user: true,
        },
      },
    },
  });

  const {
    whitelistedUsers,
    password,
    subscriptions,
    dashboardSections,
    parentSubscription,
    ...userInfo
  } = updatedUser;

  // If user.whitelistedUsers is not provided, we will assume the whitelistedUsers should be removed
  const newWhitelistedUsernames: string[] = data.whitelistedUsers || [];

  // Get the current whitelisted usernames
  const currentWhitelistedUsernames: string[] = whitelistedUsers.map(
    (data) => data.username
  );

  // Find the usernames to be deleted (present in current but not in new)
  const usernamesToDelete: string[] = currentWhitelistedUsernames.filter(
    (username) => !newWhitelistedUsernames.includes(username)
  );

  // Find the usernames to be created (present in new but not in current)
  const usernamesToCreate: string[] = newWhitelistedUsernames.filter(
    (username) =>
      !currentWhitelistedUsernames.includes(username) && username.trim() !== ""
  );

  // Delete whitelistedUsers that are not present in the new list
  await prisma.whitelistedUser.deleteMany({
    where: {
      userId: userId,
      username: {
        in: usernamesToDelete,
      },
    },
  });

  // Create new whitelistedUsers that are not in the current list, no create many ;(
  for (const username of usernamesToCreate) {
    await prisma.whitelistedUser.create({
      data: {
        username,
        userId: userId,
      },
    });
  }

  const response = {
    ...userInfo,
    whitelistedUsers: newWhitelistedUsernames,
    image: userInfo.image ? `${userInfo.image}?${Date.now()}` : "",
    subscription: {
      active: subscriptions?.active,
      quantity: subscriptions?.quantity,
    },
    parentSubscription: {
      active: parentSubscription?.active,
      user: {
        email: parentSubscription?.user.email,
      },
    },
    dashboardSections: dashboardSections,
  };

  return { response, status: 200 };
}
