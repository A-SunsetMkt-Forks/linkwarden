import React, { useEffect, useState } from "react";
import {
  LinkIncludingShortenedCollectionAndTags,
  ArchivedFormat,
} from "@linkwarden/types";
import Link from "next/link";
import {
  atLeastOneFormatAvailable,
  formatAvailable,
} from "@linkwarden/lib/formatStats";
import PreservedFormatRow from "@/components/PreserverdFormatRow";
import getPublicUserData from "@/lib/client/getPublicUserData";
import { useTranslation } from "next-i18next";
import { BeatLoader } from "react-spinners";
import { useUser } from "@linkwarden/router/user";
import { useUpdateLink, useUpdateFile } from "@linkwarden/router/links";
import LinkIcon from "./LinkViews/LinkComponents/LinkIcon";
import CopyButton from "./CopyButton";
import { useRouter } from "next/router";
import Icon from "./Icon";
import { IconWeight } from "@phosphor-icons/react";
import Image from "next/image";
import clsx from "clsx";
import toast from "react-hot-toast";
import CollectionSelection from "./InputSelect/CollectionSelection";
import TagSelection from "./InputSelect/TagSelection";
import unescapeString from "@/lib/client/unescapeString";
import IconPopover from "./IconPopover";
import TextInput from "./TextInput";
import usePermissions from "@/hooks/usePermissions";
import oklchVariableToHex from "@/lib/client/oklchVariableToHex";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "./ui/separator";

type Props = {
  className?: string;
  activeLink: LinkIncludingShortenedCollectionAndTags;
  standalone?: boolean;
  mode?: "view" | "edit";
  setMode?: Function;
  onUpdateArchive?: Function;
};

export default function LinkDetails({
  className,
  activeLink,
  standalone,
  mode = "view",
  setMode,
  onUpdateArchive,
}: Props) {
  const [link, setLink] =
    useState<LinkIncludingShortenedCollectionAndTags>(activeLink);

  useEffect(() => {
    setLink(activeLink);
  }, [activeLink]);

  const permissions = usePermissions(link.collection.id as number);

  const { t } = useTranslation();
  const { data: user } = useUser();
  const router = useRouter();

  const isPublicRoute = router.pathname.startsWith("/public") ? true : false;

  const [collectionOwner, setCollectionOwner] = useState({
    id: null as unknown as number,
    name: "",
    username: "",
    image: "",
    archiveAsScreenshot: undefined as unknown as boolean,
    archiveAsMonolith: undefined as unknown as boolean,
    archiveAsPDF: undefined as unknown as boolean,
  });

  useEffect(() => {
    const fetchOwner = async () => {
      if (link.collection.ownerId !== user?.id) {
        const owner = await getPublicUserData(
          link.collection.ownerId as number
        );
        setCollectionOwner(owner);
      } else if (link.collection.ownerId === user?.id) {
        setCollectionOwner({
          id: user?.id as number,
          name: user?.name as string,
          username: user?.username as string,
          image: user?.image as string,
          archiveAsScreenshot: user?.archiveAsScreenshot as boolean,
          archiveAsMonolith: user?.archiveAsScreenshot as boolean,
          archiveAsPDF: user?.archiveAsPDF as boolean,
        });
      }
    };

    fetchOwner();
  }, [link.collection.ownerId]);

  const isReady = () => {
    return (
      link &&
      (collectionOwner.archiveAsScreenshot === true ? link.pdf : true) &&
      (collectionOwner.archiveAsMonolith === true ? link.monolith : true) &&
      (collectionOwner.archiveAsPDF === true ? link.pdf : true) &&
      link.readable
    );
  };

  const updateLink = useUpdateLink();
  const updateFile = useUpdateFile();

  const submit = async (e?: any) => {
    e?.preventDefault();

    const { updatedAt: b, ...oldLink } = activeLink;
    const { updatedAt: a, ...newLink } = link;

    if (JSON.stringify(oldLink) === JSON.stringify(newLink)) {
      return;
    }

    const load = toast.loading(t("updating"));

    await updateLink.mutateAsync(link, {
      onSettled: (data, error) => {
        toast.dismiss(load);

        if (error) {
          toast.error(error.message);
        } else {
          toast.success(t("updated"));
          setMode && setMode("view");
          setLink(data);
        }
      },
    });
  };

  const setCollection = (e: any) => {
    if (e?.__isNew__) e.value = null;
    setLink({
      ...link,
      collection: { id: e?.value, name: e?.label, ownerId: e?.ownerId },
    });
  };

  const setTags = (e: any) => {
    const tagNames = e.map((e: any) => ({ name: e.label }));
    setLink({ ...link, tags: tagNames });
  };

  const [iconPopover, setIconPopover] = useState(false);

  return (
    <div className={clsx(className)} data-vaul-no-drag>
      <div
        className={clsx(
          standalone && "sm:border sm:border-neutral-content sm:rounded-xl p-5"
        )}
      >
        <div
          className={clsx(
            "overflow-hidden select-none relative group h-40 opacity-80",
            standalone
              ? "sm:max-w-xl -mx-5 -mt-5 sm:rounded-t-xl"
              : "-mx-4 -mt-4"
          )}
        >
          {formatAvailable(link, "preview") ? (
            <Image
              src={`/api/v1/archives/${link.id}?format=${ArchivedFormat.jpeg}&preview=true&updatedAt=${link.updatedAt}`}
              width={1280}
              height={720}
              alt=""
              className="object-cover scale-105 object-center h-full"
              style={{
                filter: "blur(1px)",
              }}
              onError={(e) => {
                const target = e.target as HTMLElement;
                target.style.display = "none";
              }}
            />
          ) : link.preview === "unavailable" ? (
            <div className="bg-gray-50 duration-100 h-40"></div>
          ) : (
            <div className="h-40 skeleton rounded-none"></div>
          )}

          {!standalone &&
            (permissions === true || permissions?.canUpdate) &&
            !isPublicRoute && (
              <div className="absolute top-0 bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 duration-100 flex justify-end items-end">
                <Button
                  className="mb-2 mr-3 opacity-50 hover:opacity-100 p-0"
                  size="sm"
                >
                  <label className="cursor-pointer py-1 px-2 w-full">
                    {t("upload_banner")}
                    <input
                      type="file"
                      accept="image/jpg, image/jpeg"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        const load = toast.loading(t("updating"));

                        await updateFile.mutateAsync(
                          {
                            linkId: link.id as number,
                            file,
                          },
                          {
                            onSettled: (data, error) => {
                              toast.dismiss(load);

                              if (error) {
                                toast.error(error.message);
                              } else {
                                toast.success(t("updated"));
                                setLink({ updatedAt: data.updatedAt, ...link });
                              }
                            },
                          }
                        );
                      }}
                      className="hidden"
                    />
                  </label>
                </Button>
              </div>
            )}
        </div>

        {!standalone &&
        (permissions === true || permissions?.canUpdate) &&
        !isPublicRoute ? (
          <div className="-mt-14 ml-8 relative w-fit pb-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <LinkIcon
                    link={link}
                    className="hover:bg-opacity-70 duration-100 cursor-pointer"
                    onClick={() => setIconPopover(true)}
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t("change_icon")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {iconPopover && (
              <IconPopover
                color={link.color || oklchVariableToHex("--p")}
                setColor={(color: string) => setLink({ ...link, color })}
                weight={(link.iconWeight || "regular") as IconWeight}
                setWeight={(iconWeight: string) =>
                  setLink({ ...link, iconWeight })
                }
                iconName={link.icon as string}
                setIconName={(icon: string) => setLink({ ...link, icon })}
                reset={() =>
                  setLink({
                    ...link,
                    color: "",
                    icon: "",
                    iconWeight: "",
                  })
                }
                className="top-12"
                onClose={() => {
                  setIconPopover(false);
                  submit();
                }}
              />
            )}
          </div>
        ) : (
          <div className="-mt-14 ml-8 relative w-fit pb-2">
            <LinkIcon link={link} onClick={() => setIconPopover(true)} />
          </div>
        )}

        <div className="sm:px-8 p-5 pb-8 pt-2">
          {mode === "view" && (
            <div className="text-xl mt-2 pr-7">
              <p
                className={clsx("relative w-fit", !link.name && "text-neutral")}
              >
                {unescapeString(link.name) || t("untitled")}
              </p>
            </div>
          )}

          {mode === "edit" && (
            <>
              <br />

              <div>
                <p className="text-sm mb-2 text-neutral relative w-fit flex justify-between">
                  {t("name")}
                </p>
                <TextInput
                  value={link.name}
                  onChange={(e) => setLink({ ...link, name: e.target.value })}
                  placeholder={t("placeholder_example_link")}
                  className="bg-base-200"
                />
              </div>
            </>
          )}

          {link.url && mode === "view" ? (
            <>
              <br />

              <p className="text-sm mb-2 text-neutral">{t("link")}</p>

              <div className="relative">
                <div className="rounded-md p-2 bg-base-200 hide-scrollbar overflow-x-auto whitespace-nowrap flex justify-between items-center gap-2 pr-14">
                  <Link href={link.url} title={link.url} target="_blank">
                    {link.url}
                  </Link>
                  <div className="absolute right-0 px-2 bg-base-200">
                    <CopyButton text={link.url} />
                  </div>
                </div>
              </div>
            </>
          ) : activeLink.url ? (
            <>
              <br />

              <div>
                <p className="text-sm mb-2 text-neutral relative w-fit flex justify-between">
                  {t("link")}
                </p>
                <TextInput
                  value={link.url || ""}
                  onChange={(e) => setLink({ ...link, url: e.target.value })}
                  placeholder={t("placeholder_example_link")}
                  className="bg-base-200"
                />
              </div>
            </>
          ) : undefined}

          <br />

          <div className="relative">
            <p className="text-sm mb-2 text-neutral relative w-fit flex justify-between">
              {t("collection")}
            </p>

            {mode === "view" ? (
              <div className="relative">
                <Link
                  href={
                    isPublicRoute
                      ? `/public/collections/${link.collection.id}`
                      : `/collections/${link.collection.id}`
                  }
                  className="rounded-md p-2 bg-base-200 border border-base-200 hide-scrollbar overflow-x-auto whitespace-nowrap flex justify-between items-center gap-2 pr-14"
                >
                  <p>{link.collection.name}</p>
                  <div className="absolute right-0 px-2 bg-base-200">
                    {link.collection.icon ? (
                      <Icon
                        icon={link.collection.icon}
                        size={30}
                        weight={
                          (link.collection.iconWeight ||
                            "regular") as IconWeight
                        }
                        color={link.collection.color}
                      />
                    ) : (
                      <i
                        className="bi-folder-fill text-xl"
                        style={{ color: link.collection.color }}
                      ></i>
                    )}
                  </div>
                </Link>
              </div>
            ) : (
              <CollectionSelection
                onChange={setCollection}
                defaultValue={
                  link.collection.id
                    ? { value: link.collection.id, label: link.collection.name }
                    : { value: null as unknown as number, label: "Unorganized" }
                }
                creatable={false}
              />
            )}
          </div>

          <br />

          <div className="relative">
            <p className="text-sm mb-2 text-neutral relative w-fit flex justify-between">
              {t("tags")}
            </p>

            {mode === "view" ? (
              <div className="flex gap-2 flex-wrap rounded-md p-2 bg-base-200 border border-base-200 w-full text-xs">
                {link.tags && link.tags[0] ? (
                  link.tags.map((tag) =>
                    isPublicRoute ? (
                      <div
                        key={tag.id}
                        className="bg-base-200 p-1 hover:bg-neutral-content rounded-md duration-100"
                      >
                        {tag.name}
                      </div>
                    ) : (
                      <Link
                        href={"/tags/" + tag.id}
                        key={tag.id}
                        className="bg-base-200 py-1 px-2 hover:bg-neutral-content rounded-sm duration-150"
                      >
                        {tag.name}
                      </Link>
                    )
                  )
                ) : (
                  <div className="text-neutral text-base">{t("no_tags")}</div>
                )}
              </div>
            ) : (
              <TagSelection
                onChange={setTags}
                defaultValue={link.tags.map((e) => ({
                  label: e.name,
                  value: e.id,
                }))}
              />
            )}
          </div>

          <br />

          <div className="relative">
            <p className="text-sm mb-2 text-neutral relative w-fit flex justify-between">
              {t("description")}
            </p>

            {mode === "view" ? (
              <div className="rounded-md p-2 bg-base-200 hyphens-auto">
                {link.description ? (
                  <p>{link.description}</p>
                ) : (
                  <p className="text-neutral">{t("no_description_provided")}</p>
                )}
              </div>
            ) : (
              <textarea
                value={unescapeString(link.description) as string}
                onChange={(e) =>
                  setLink({ ...link, description: e.target.value })
                }
                placeholder={t("link_description_placeholder")}
                className="resize-none w-full rounded-md p-2 h-32 border-neutral-content bg-base-200 focus:border-primary border-solid border outline-none duration-100"
              />
            )}
          </div>

          {mode === "view" && (
            <div>
              <br />

              <div className="flex gap-1 items-center mb-2">
                <p
                  className="text-sm text-neutral"
                  title={t("available_formats")}
                >
                  {link.url ? t("preserved_formats") : t("content")}
                </p>

                {onUpdateArchive &&
                  (permissions === true || permissions?.canUpdate) &&
                  !isPublicRoute &&
                  link.url && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-neutral"
                            onClick={() => onUpdateArchive()}
                          >
                            <i className="bi-arrow-clockwise text-sm" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>{t("refresh_preserved_formats")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
              </div>

              <div className={`flex flex-col rounded-md p-3 bg-base-200`}>
                {formatAvailable(link, "monolith") ? (
                  <>
                    <PreservedFormatRow
                      name={t("webpage")}
                      icon={"bi-filetype-html"}
                      format={ArchivedFormat.monolith}
                      link={link}
                      downloadable={true}
                    />
                    <Separator className="my-3" />
                  </>
                ) : undefined}

                {formatAvailable(link, "image") ? (
                  <>
                    <PreservedFormatRow
                      name={t("screenshot")}
                      icon={"bi-file-earmark-image"}
                      format={
                        link?.image?.endsWith("png")
                          ? ArchivedFormat.png
                          : ArchivedFormat.jpeg
                      }
                      link={link}
                      downloadable={true}
                    />
                    <Separator className="my-3" />
                  </>
                ) : undefined}

                {formatAvailable(link, "pdf") ? (
                  <>
                    <PreservedFormatRow
                      name={t("pdf")}
                      icon={"bi-file-earmark-pdf"}
                      format={ArchivedFormat.pdf}
                      link={link}
                      downloadable={true}
                    />
                    <Separator className="my-3" />
                  </>
                ) : undefined}

                {formatAvailable(link, "readable") ? (
                  <>
                    <PreservedFormatRow
                      name={t("readable")}
                      icon={"bi-file-earmark-text"}
                      format={ArchivedFormat.readability}
                      link={link}
                    />
                    <Separator className="my-3" />
                  </>
                ) : undefined}

                {!isReady() && !atLeastOneFormatAvailable(link) ? (
                  <div
                    className={`w-full h-full flex flex-col justify-center p-10`}
                  >
                    <BeatLoader
                      color="oklch(var(--p))"
                      className="mx-auto mb-3"
                      size={30}
                    />

                    <p className="text-center text-xl">
                      {t("preservation_in_queue")}
                    </p>
                    <p className="text-center text-lg">
                      {t("check_back_later")}
                    </p>
                  </div>
                ) : link.url &&
                  !isReady() &&
                  atLeastOneFormatAvailable(link) ? (
                  <div
                    className={`w-full h-full flex flex-col justify-center p-5`}
                  >
                    <BeatLoader
                      color="oklch(var(--p))"
                      className="mx-auto mb-3"
                      size={20}
                    />
                    <p className="text-center">{t("there_are_more_formats")}</p>
                    <p className="text-center text-sm">
                      {t("check_back_later")}
                    </p>
                  </div>
                ) : undefined}

                {link.url && (
                  <Link
                    href={`https://web.archive.org/web/${link?.url?.replace(
                      /(^\w+:|^)\/\//,
                      ""
                    )}`}
                    target="_blank"
                    className="text-neutral mx-auto duration-100 hover:opacity-60 flex gap-2 w-1/2 justify-center items-center text-sm"
                  >
                    <p className="whitespace-nowrap">
                      {t("view_latest_snapshot")}
                    </p>
                    <i className="bi-box-arrow-up-right" />
                  </Link>
                )}
              </div>
            </div>
          )}

          {mode === "view" ? (
            <>
              <br />

              <p className="text-neutral text-xs text-center">
                {t("saved")}{" "}
                {new Date(link.createdAt || "").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                at{" "}
                {new Date(link.createdAt || "").toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "numeric",
                })}
              </p>
            </>
          ) : (
            <>
              <br />
              <div className="flex justify-end items-center">
                <Button
                  variant="accent"
                  disabled={JSON.stringify(activeLink) === JSON.stringify(link)}
                  onClick={submit}
                >
                  {t("save_changes")}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
