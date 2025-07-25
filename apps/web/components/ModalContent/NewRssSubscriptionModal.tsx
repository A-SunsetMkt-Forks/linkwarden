import React, { useLayoutEffect, useRef, useState } from "react";
import Modal from "../Modal";
import { useTranslation } from "next-i18next";
import { useAddRssSubscription } from "@linkwarden/router/rss";
import toast from "react-hot-toast";
import TextInput from "../TextInput";
import CollectionSelection from "../InputSelect/CollectionSelection";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

type Props = {
  onClose: Function;
};

export default function NewRssSubscriptionModal({ onClose }: Props) {
  const { t } = useTranslation();
  const addRssSubscription = useAddRssSubscription();
  const [submitLoader, setSubmitLoader] = useState(false);

  const [form, setForm] = useState({
    name: "",
    url: "",
    collectionId: 0,
    collectionName: "",
  });

  const submit = async () => {
    if (submitLoader) return;

    if (
      !form.name ||
      !form.url ||
      (!form.collectionId && !form.collectionName)
    ) {
      return toast.error(t("fill_all_fields"));
    }

    setSubmitLoader(true);

    const load = toast.loading(t("creating"));

    await addRssSubscription.mutateAsync(form, {
      onSettled: (_, error) => {
        setSubmitLoader(false);
        toast.dismiss(load);

        if (error) {
          toast.error(error.message);
        } else {
          onClose();
          toast.success(t("created"));
        }
      },
    });
  };

  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Modal toggleModal={onClose}>
      <>
        <p className="text-xl font-thin">{t("create_rss_subscription")}</p>

        <Separator className="my-3" />

        <div className="w-full mb-3">
          <label>{t("link")}</label>
          <TextInput
            ref={inputRef}
            type="text"
            placeholder="https://example.com/rss"
            className="bg-base-200 mt-2"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
        </div>

        <div className="flex sm:flex-row flex-col gap-3 items-center">
          <div className="w-full">
            <label>{t("name")}</label>
            <TextInput
              type="text"
              placeholder="Sample RSS"
              className="bg-base-200 mt-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="w-full">
            <label>{t("collection")}</label>
            <CollectionSelection
              className="mt-2"
              onChange={(e: any) => {
                if (e?.__isNew__) e.value = undefined;
                setForm({
                  ...form,
                  collectionId: e?.value,
                  collectionName: e?.label,
                });
              }}
            />
          </div>
        </div>

        <div className="flex justify-end items-center mt-5">
          <Button variant="accent" onClick={submit}>
            {t("create_rss_subscription")}
          </Button>
        </div>
      </>
    </Modal>
  );
}
