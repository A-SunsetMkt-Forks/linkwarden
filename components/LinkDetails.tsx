import React, { useEffect, useRef, useState } from "react";
import {
  LinkIncludingShortenedCollectionAndTags,
  ArchivedFormat,
} from "@/types/global";
import Link from "next/link";
import { formatAvailable } from "@/lib/shared/formatStats";
import getPublicUserData from "@/lib/client/getPublicUserData";
import { useTranslation } from "next-i18next";
import { useUser } from "@/hooks/store/user";
import { useGetLink, useUpdateLink, useUpdateFile } from "@/hooks/store/links";
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
import Preservation from "./Preservation";
import useWindowDimensions from "@/hooks/useWindowDimensions";

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

  const { width } = useWindowDimensions();

  const iconTriggerRef = useRef<HTMLDivElement>(null);
  const [iconPopoverPosition, setIconPopoverPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const { t } = useTranslation();
  const getLink = useGetLink();
  const { data: user = {} } = useUser();

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
      if (link.collection.ownerId !== user.id) {
        const owner = await getPublicUserData(
          link.collection.ownerId as number
        );
        setCollectionOwner(owner);
      } else if (link.collection.ownerId === user.id) {
        setCollectionOwner({
          id: user.id as number,
          name: user.name,
          username: user.username as string,
          image: user.image as string,
          archiveAsScreenshot: user.archiveAsScreenshot as boolean,
          archiveAsMonolith: user.archiveAsScreenshot as boolean,
          archiveAsPDF: user.archiveAsPDF as boolean,
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

  useEffect(() => {
    (async () => {
      await getLink.mutateAsync({
        id: link.id as number,
      });
    })();

    let interval: any;

    if (!isReady()) {
      interval = setInterval(async () => {
        await getLink.mutateAsync({
          id: link.id as number,
        });
      }, 5000);
    } else {
      if (interval) {
        clearInterval(interval);
      }
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [link.monolith]);

  const router = useRouter();

  const isPublicRoute = router.pathname.startsWith("/public") ? true : false;

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
    <div className={clsx(className)}>
      <div
        className={clsx(
          standalone &&
            "sm:border sm:border-neutral-content sm:rounded-2xl sm:overflow-auto",
          width >= 640 && "flex h-[80vh]"
        )}
      >
        {width >= 640 && (
          <div className="w-1/2 lg:w-2/3 overflow-y-auto">
            {link.id && <Preservation link={link} standalone={standalone} />}
          </div>
        )}
        <div className={clsx(width >= 640 && "w-1/2 lg:w-1/3 overflow-y-auto")}>
          <div
            className={clsx(
              "overflow-hidden select-none relative group/banner h-40 opacity-80 rounded-t-2xl sm:rounded-tr-2xl sm:rounded-tl-none -mt-5 sm:mt-0",
              !standalone && "-mx-5 sm:mx-0"
            )}
          >
            {formatAvailable(link, "preview") ? (
              <Image
                src={`/api/v1/archives/${link.id}?format=${ArchivedFormat.jpeg}&preview=true&updatedAt=${link.updatedAt}`}
                width={1280}
                height={720}
                alt=""
                className="object-cover object-center h-full"
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
              <div className="duration-100 h-40 skeleton rounded-none"></div>
            )}

            {!standalone &&
              (permissions === true || permissions?.canUpdate) &&
              !isPublicRoute && (
                <div
                  className={clsx(
                    "absolute top-0 bottom-0 left-0 right-0 opacity-0 group-hover/banner:opacity-100 duration-100 flex justify-end items-end"
                  )}
                >
                  <label className="btn btn-xs mb-2 mr-3 opacity-50 hover:opacity-100">
                    {t("upload_banner")}
                    <input
                      type="file"
                      accept="image/jpg, image/jpeg, image/png"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        const load = toast.loading(t("updating"));

                        await updateFile.mutateAsync(
                          {
                            linkId: link.id as number,
                            file,
                            isPreview: true,
                          },
                          {
                            onSettled: (data, error) => {
                              toast.dismiss(load);

                              if (error) {
                                toast.error(error.message);
                              } else {
                                toast.success(t("updated"));
                                setLink({
                                  updatedAt: data.response.updatedAt,
                                  ...link,
                                });
                              }
                            },
                          }
                        );
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
          </div>

          {!standalone &&
          (permissions === true || permissions?.canUpdate) &&
          !isPublicRoute ? (
            <div className="-mt-14 ml-8 relative w-fit pb-2">
              <div
                className="tooltip tooltip-bottom"
                ref={iconTriggerRef}
                data-tip={t("change_icon")}
              >
                <LinkIcon
                  link={link}
                  className="hover:bg-opacity-70 duration-100 cursor-pointer"
                  onClick={() => {
                    if (iconTriggerRef.current) {
                      const rect =
                        iconTriggerRef.current.getBoundingClientRect();
                      if (width >= 640) {
                        setIconPopoverPosition({
                          top: rect.bottom + window.scrollY,
                          left: rect.left + rect.width / 2 + window.scrollX, // center of LinkIcon
                        });
                      } else {
                        setIconPopoverPosition({
                          top: rect.bottom + window.scrollY,
                          left: rect.left + window.scrollX,
                        });
                      }
                    }
                    setIconPopover(true);
                  }}
                />
              </div>
              {iconPopover && iconPopoverPosition && (
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
                  className={clsx(width >= 640 && "-translate-x-1/2")}
                  top={width >= 640 ? iconPopoverPosition.top : undefined}
                  left={width >= 640 ? iconPopoverPosition.left : undefined}
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

          <div className={clsx("pb-8 pt-2 p-3", width < 640 && "sm:px-8")}>
            {mode === "view" && (
              <div className="text-xl mt-2 pr-7">
                <p
                  className={clsx(
                    "relative w-fit",
                    !link.name && "text-neutral"
                  )}
                >
                  {unescapeString(link.name) || t("untitled")}
                </p>
              </div>
            )}

            {mode === "view" && width < 640 && (
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
                    link.type === "url" &&
                    (permissions === true || permissions?.canUpdate) &&
                    !isPublicRoute && (
                      <div
                        className="tooltip tooltip-bottom"
                        data-tip={t("refresh_preserved_formats")}
                      >
                        <button
                          className="btn btn-xs btn-ghost btn-square text-neutral"
                          onClick={() => onUpdateArchive()}
                        >
                          <i className="bi-arrow-clockwise text-sm" />
                        </button>
                      </div>
                    )}
                </div>

                {link.id && (
                  <Preservation link={link} standalone={standalone} />
                )}
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
                          className="bi-folder-fill text-2xl"
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
                      ? {
                          value: link.collection.id,
                          label: link.collection.name,
                        }
                      : {
                          value: null as unknown as number,
                          label: "Unorganized",
                        }
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
                          className="bg-base-200 p-1 hover:bg-neutral-content btn btn-xs btn-ghost rounded-md"
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
                    <p className="text-neutral">
                      {t("no_description_provided")}
                    </p>
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
                  <button
                    className={clsx(
                      "btn btn-accent text-white",
                      JSON.stringify(activeLink) === JSON.stringify(link)
                        ? "btn-disabled"
                        : "dark:border-violet-400"
                    )}
                    onClick={submit}
                  >
                    {t("save_changes")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
